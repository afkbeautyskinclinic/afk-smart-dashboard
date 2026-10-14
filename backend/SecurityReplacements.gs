/** Candidate replacements: replace matching functions; do not install duplicate definitions. */
function route_(request) {
  try {
    const action = String(request.action || "health");
    if (action === "health") return json_(health_());
    const handlers = {
      login: afkHandleLogin_,
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
