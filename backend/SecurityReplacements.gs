/** Candidate replacements: replace matching functions; do not install duplicate definitions. */
function route_(request) {
  try {
    const action = String(request.action || "health");
    if (action === "health") return json_(health_());
    const handlers = {
      login: afkHandleLoginWithInitialData_,
      logout: afkHandleLogout_,
      validateSession: afkHandleValidateSession_,
      secureFetch: afkHandleSecureFetch_,
      secureSyncMutations: afkHandleSecureSyncMutations_,
      secureUploadTreatmentMedia: afkHandleSecureUploadTreatmentMedia_,
      secureUpdateAuthUsers: afkHandleSecureUpdateAuthUsers_
    };
    // Legacy endpoints bypass session/RBAC and can replace complete datasets.
    if (["bootstrap", "fetch", "sync", "syncMutations", "uploadTreatmentMedia"].indexOf(action) !== -1) {
      return json_({ ok: false, error: "LEGACY_API_DISABLED" });
    }
    if (!Object.prototype.hasOwnProperty.call(handlers, action)) {
      return json_({ ok: false, error: "Action backend tidak dikenal." });
    }
    if (action !== "secureFetch" && request.method !== "POST") {
      return json_({ ok: false, error: "POST_REQUIRED" });
    }
    return json_(handlers[action](request));
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}


function afkValidateSession_(sessionToken) {
  var token = String(sessionToken || "").trim();
  if (!token) throw new Error("AUTH_REQUIRED");

  var ss = afkAuthSpreadsheet_();
  // Read existing auth storage without creating sheets or rereading both schemas.
  var sheet = ss.getSheetByName(AFK_AUTH_SESSIONS_SHEET);
  if (!sheet) throw new Error("AUTH_INVALID");
  var headers = afkGetAuthHeaders_(sheet);
  var tokenHash = afkDigestHex_(token);
  var rowIndex = afkFindAuthRowByValue_(sheet, headers, "sessionTokenHash", tokenHash);
  if (rowIndex < 2) throw new Error("AUTH_INVALID");

  var session = afkReadAuthRow_(sheet, headers, rowIndex);
  if (!afkBoolean_(session.active)) throw new Error("AUTH_REVOKED");

  var now = new Date();
  var expiresAt = new Date(session.expiresAt);
  if (!session.expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    afkUpdateAuthRow_(sheet, headers, rowIndex, { active: false, lastSeenAt: now.toISOString() });
    afkAuthAudit_("SESSION_EXPIRED", "Session expired.", {
      userId: session.userId,
      username: session.username,
      role: session.role,
      session: afkMaskToken_(token)
    });
    throw new Error("AUTH_EXPIRED");
  }

  // Revalidate the account on every request; revoked/changed users cannot
  // retain the role recorded in a previously issued session.
  var user = afkFindAuthUserByUsername_(ss, afkUsernameKey_(session.username));
  if (!user || !afkBoolean_(user.active) ||
      String(user.userId || "") !== String(session.userId || "") ||
      !afkIsKnownAuthRole_(user.role) ||
      afkNormalizeAuthRole_(user.role) !== afkNormalizeAuthRole_(session.role)) {
    throw new Error("AUTH_REVOKED");
  }
  var lastSeenAt = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  if (!lastSeenAt || now.getTime() - lastSeenAt >= 5 * 60 * 1000) {
    afkUpdateAuthRow_(sheet, headers, rowIndex, { lastSeenAt: now.toISOString() });
  }
  return {
    userId: session.userId,
    username: user.username,
    role: afkNormalizeAuthRole_(user.role)
  };
}

function afkHandleSecureFetch_(request) {
  var startedAt = Date.now();
  var identity = afkRequireSession_(request);
  var authMs = Date.now() - startedAt;
  var requested = afkRequestedDatasets_(request);
  var ss = afkAuthSpreadsheet_();
  var allowed = requested.filter(function(dataset) {
    if (!afkCanAccessDataset_(identity.role, dataset, "read")) {
      afkAuthorizationAudit_("AUTHORIZATION_FAILED", identity, "fetch", dataset, request.requestId);
      return false;
    }
    return true;
  });
  if (allowed.length !== requested.length) throw new Error("Akses dataset ditolak.");

  var result = afkFetchAuthorizedDatasetsOptimized_(requested, allowed, ss);
  result.success = true;
  result.user = identity;
  result.timing.authMs = authMs;
  result.timing.settingsMs = 0;

  if (String(request.includeSettings || "").toLowerCase() === "true" && afkCanAccessSettings_(identity.role)) {
    var settingsStartedAt = Date.now();
    result.data.settings = afkSanitizeClientSettings_(readSettings_(ss));
    result.timing.settingsMs = Date.now() - settingsStartedAt;
  }
  result.timing.totalMs = Date.now() - startedAt;
  afkAuthorizationAudit_("SECURE_FETCH", identity, "fetch", Object.keys(result.data).join(","), request.requestId);
  return result;
}

function afkSanitizeClientSettings_(value) {
  if (Array.isArray(value)) return value.map(afkSanitizeClientSettings_);
  if (!value || typeof value !== "object") return value;
  var safe = {};
  Object.keys(value).forEach(function(key) {
    // Omit credential fields at every nesting level, including legacy accounts.
    var normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (/(password|passwd|token|secret|apikey)/.test(normalized) ||
        ["backendurl", "authorization", "credentials"].indexOf(normalized) !== -1) return;
    Object.defineProperty(safe, key, {
      value: afkSanitizeClientSettings_(value[key]), enumerable: true,
      configurable: true, writable: true
    });
  });
  return safe;
}


var AFK_AUTH_REQUEST_SPREADSHEET_ = null;
function afkAuthSpreadsheet_() {
  // In-memory handle reused only inside this Apps Script execution, not a
  // shared authentication cache. Every request still rereads session/user state.
  if (!AFK_AUTH_REQUEST_SPREADSHEET_) {
    AFK_AUTH_REQUEST_SPREADSHEET_ = typeof getSpreadsheet_ === "function"
      ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  }
  return AFK_AUTH_REQUEST_SPREADSHEET_;
}

function afkHandleLoginWithInitialData_(request) {
  var result = afkHandleLogin_(request);
  if (!result.ok || !result.success || !result.sessionToken || !result.user ||
      request.includeOwnerData !== true || afkNormalizeAuthRole_(result.user.role) !== "Owner") return result;
  var datasets = ["manager", "marketing", "crm", "content", "doctor", "medis", "inventory",
    "managerMarketingDaily", "patientCommand", "managerDecisionLog", "ownerEscalation"];
  try {
    // Reuse current-session and dataset authorization checks, even after login.
    result.initialData = afkHandleSecureFetch_({sessionToken: result.sessionToken, datasets: datasets});
  } catch (error) {
    if (/^AUTH_(REQUIRED|INVALID|REVOKED|EXPIRED)$/.test(String(error.message || ""))) throw error;
    result.initialDataError = "INITIAL_DATA_UNAVAILABLE";
  }
  return result;
}

function afkHandleSecureSyncMutations_(request) {
  var identity = afkRequireSession_(request);
  var mutations = Array.isArray(request.mutations) ? request.mutations : [];
  if (mutations.length > 20) throw new Error("Maksimal 20 perubahan per batch.");
  var checked = [];
  var authorizationResults = [];

  mutations.forEach(function(mutation) {
    if (!mutation || !mutation.id) {
      authorizationResults.push({ operationId: "", dataset: "", status: "PERMANENT_ERROR", error: "Mutation atau operationId tidak valid." });
      return;
    }
    var dataset = String(mutation.dataset || "");
    var operation = mutation.type === "delete" ? "delete" : "write";
    if (!afkCanAccessDataset_(identity.role, dataset, operation)) {
      afkAuthorizationAudit_("AUTHORIZATION_FAILED", identity, "syncMutations:" + operation, dataset, mutation.id);
      authorizationResults.push({ operationId: String(mutation.id), dataset: dataset, status: "FORBIDDEN", error: "Akses ditolak untuk dataset." });
      return;
    }
    if (afkIsScopedDivisionNoteRole_(identity.role) && ["marketing", "content", "crm", "doctor", "medis", "inventory"].indexOf(dataset) !== -1 && mutation.type !== "update") {
      authorizationResults.push({ operationId: String(mutation.id), dataset: dataset, status: "FORBIDDEN", error: "Role ini hanya dapat memperbarui kolom catatan pada dashboard divisi." });
      return;
    }
    var safeMutation = {};
    Object.keys(mutation).forEach(function(key) { safeMutation[key] = mutation[key]; });
    safeMutation.actorRole = identity.role;
    safeMutation.actorUserId = identity.userId;
    safeMutation.actorUsername = identity.username;
    if (dataset === "settings" && afkNormalizeAuthRole_(identity.role) !== "Owner") {
      // Inventory may edit operational settings, but never login/menu identities.
      safeMutation.row = {};
      Object.keys(mutation.row || {}).forEach(function(key) {
        if (key !== "userAccounts") safeMutation.row[key] = mutation.row[key];
      });
    }
    safeMutation = afkScopeMutationForIdentity_(safeMutation, identity);
    checked.push(safeMutation);
  });

  var payload = {};
  Object.keys(request || {}).forEach(function(key) { payload[key] = request[key]; });
  payload.mutations = checked;
  var result = afkHandleSyncMutations_(payload);
  result.results = authorizationResults.concat(result.results || []);
  result.permanentIds = (result.permanentIds || []).concat(authorizationResults.map(function(item) { return item.operationId; }).filter(Boolean));
  afkAuthorizationAudit_("SECURE_SYNC_MUTATIONS", identity, "syncMutations", checked.map(function(item) { return item.dataset; }).join(","), request.requestId);
  return result;
}

function afkHandleSecureUpdateAuthUsers_(request) {
  var identity = afkRequireSession_(request);
  if (afkNormalizeAuthRole_(identity.role) !== "Owner") {
    afkAuthorizationAudit_("AUTH_USER_ADMIN_FORBIDDEN", identity, "secureUpdateAuthUsers", "settings", "");
    throw new Error("FORBIDDEN");
  }

  var accounts = Array.isArray(request.accounts) ? request.accounts : [];
  if (!accounts.length || accounts.length > 20) throw new Error("Daftar perubahan akun tidak valid.");

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Layanan akun sedang sibuk. Silakan coba lagi.");
  try {
    var ss = afkAuthSpreadsheet_();
    afkEnsureAuthSheets_(ss);
    var usersSheet = afkGetOrCreateAuthSheet_(ss, AFK_AUTH_USERS_SHEET, AFK_AUTH_USER_HEADERS);
    var userHeaders = afkGetAuthHeaders_(usersSheet);
    var sessionSheet = afkGetOrCreateAuthSheet_(ss, AFK_AUTH_SESSIONS_SHEET, AFK_AUTH_SESSION_HEADERS);
    var sessionHeaders = afkGetAuthHeaders_(sessionSheet);
    var currentSessionHash = afkDigestHex_(String(request.sessionToken || ""));
    var results = [];

    accounts.forEach(function(change) {
      var role = afkNormalizeAuthRole_(change && change.role);
      var originalUsername = String(change && change.originalUsername || "").trim();
      var username = String(change && change.username || "").trim();
      var newPassword = String(change && change.newPassword || "");
      if (!afkIsKnownAuthRole_(role)) throw new Error("Role akun tidak dikenal.");
      if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) throw new Error("Username " + role + " harus 3-64 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.");
      if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) throw new Error("Password baru " + role + " harus terdiri dari 8-128 karakter.");

      var rowIndex = afkFindAuthRowByValue_(usersSheet, userHeaders, "role", role);
      if (rowIndex < 2 && originalUsername) rowIndex = afkFindAuthRowByValue_(usersSheet, userHeaders, "usernameKey", afkUsernameKey_(originalUsername));
      if (rowIndex < 2) throw new Error("Akun " + role + " tidak ditemukan.");

      var duplicateIndex = afkFindAuthRowByValue_(usersSheet, userHeaders, "usernameKey", afkUsernameKey_(username));
      if (duplicateIndex > 1 && duplicateIndex !== rowIndex) throw new Error("Username sudah digunakan akun lain.");

      var current = afkReadAuthRow_(usersSheet, userHeaders, rowIndex);
      var update = {
        username: username,
        usernameKey: afkUsernameKey_(username),
        role: role,
        active: role === "Owner" ? true : change.active !== false,
        updatedAt: new Date().toISOString()
      };
      if (newPassword) {
        var passwordRecord = afkBuildPasswordRecord_(newPassword);
        update.passwordHash = passwordRecord.passwordHash;
        update.passwordSalt = passwordRecord.passwordSalt;
        update.passwordAlgorithm = passwordRecord.passwordAlgorithm;
        update.passwordIterations = passwordRecord.passwordIterations;
      }
      afkUpdateAuthRow_(usersSheet, userHeaders, rowIndex, update);

      var identityChanged = username !== String(current.username || "") || Boolean(newPassword) || afkBoolean_(current.active) !== update.active;
      if (identityChanged) afkRevokeUserSessionsExcept_(sessionSheet, sessionHeaders, current.userId, currentSessionHash);
      results.push({ role: role, username: username, active: update.active, passwordChanged: Boolean(newPassword) });
    });

    afkAuthAudit_("AUTH_USERS_ADMIN_UPDATED", "Akun pengguna diperbarui dari menu Setting.", {
      userId: identity.userId,
      username: identity.username,
      role: identity.role,
      changedRoles: results.map(function(item) { return item.role; })
    });
    return { ok: true, updated: results, callerSessionRevoked: false };
  } finally {
    lock.releaseLock();
  }
}
