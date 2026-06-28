// Dictionary of well-known claim type URIs and special issuers, plus helpers
// to render long URIs as short, human-friendly names.

export interface ClaimTypeInfo {
  uri: string;
  /** Short friendly name, e.g. "UPN". */
  short: string;
  /** One-line description of what the claim represents. */
  description: string;
}

const TYPES: ClaimTypeInfo[] = [
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname",
    short: "Windows account name",
    description: "The user's DOMAIN\\username, e.g. CONTOSO\\jdoe.",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
    short: "UPN",
    description: "User Principal Name, e.g. jdoe@contoso.com.",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    short: "Role",
    description: "A role/group membership granted to the user.",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    short: "Email address",
    description: "The user's email address.",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    short: "Name",
    description: "A display or logon name for the user.",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    short: "Given name",
    description: "The user's first name.",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    short: "Surname",
    description: "The user's last name.",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid",
    short: "Group SID",
    description: "Security identifier (SID) of a group the user belongs to.",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/primarygroupsid",
    short: "Primary group SID",
    description: "SID of the user's primary group.",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/primarysid",
    short: "Primary SID",
    description: "The user's own security identifier (SID).",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/denyonlysid",
    short: "Deny-only SID",
    description: "A SID used only to deny access.",
  },
  {
    uri: "http://schemas.xmlsoap.org/claims/CommonName",
    short: "Common name",
    description: "The user's common name (CN).",
  },
  {
    uri: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    short: "Name ID",
    description: "The SAML NameID — the principal's subject identifier.",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod",
    short: "Authentication method",
    description: "How the user authenticated (password, certificate, ...).",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationinstant",
    short: "Authentication instant",
    description: "When the user authenticated.",
  },
  {
    uri: "http://schemas.microsoft.com/authorization/claims/permit",
    short: "Permit",
    description: "Authorization decision: allow this user to be issued a token.",
  },
  {
    uri: "http://schemas.microsoft.com/authorization/claims/deny",
    short: "Deny",
    description: "Authorization decision: block this user from getting a token.",
  },
  {
    uri: "http://schemas.microsoft.com/2012/01/devicecontext/claims/isregistereduser",
    short: "Is registered device user",
    description: "Whether the device is registered (workplace joined).",
  },
  {
    uri: "http://schemas.microsoft.com/ws/2008/06/identity/claims/proxy",
    short: "Proxy",
    description: "Indicates the request came through the Web Application Proxy.",
  },
];

const BY_URI = new Map(TYPES.map((t) => [t.uri, t]));

/** Well-known issuer values that appear in claim conditions. */
const KNOWN_ISSUERS: Record<string, string> = {
  "AD AUTHORITY": "the local Active Directory",
  SELF: "AD FS itself",
  "LOCAL AUTHORITY": "the AD FS server",
};

export function lookupClaimType(uri: string): ClaimTypeInfo | undefined {
  return BY_URI.get(uri);
}

/** All known claim types, for use in the builder's dropdowns. */
export function knownClaimTypes(): ClaimTypeInfo[] {
  return TYPES.slice();
}

/** Short friendly name for a claim type URI, falling back to its last segment. */
export function friendlyClaimType(uri: string): string {
  const info = BY_URI.get(uri);
  if (info) return info.short;
  // Fall back to the final path segment of the URI.
  const trimmed = uri.replace(/\/+$/, "");
  const seg = trimmed.split("/").pop() ?? uri;
  return seg || uri;
}

export function describeIssuer(issuer: string): string {
  return KNOWN_ISSUERS[issuer] ?? `"${issuer}"`;
}
