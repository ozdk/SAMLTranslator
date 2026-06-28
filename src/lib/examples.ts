// A curated library of real-world ADFS Claim Rules, used to populate the
// "Load example" picker in the Translate view. Each is valid claim-rules text
// that an admin could paste straight into AD FS.

export interface Example {
  id: string;
  name: string;
  description: string;
  rules: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "upn-roles",
    name: "LDAP — UPN and roles",
    description: "Look up the UPN and group memberships from Active Directory.",
    rules: `@RuleTemplate = "LdapClaims"
@RuleName = "UPN and Roles"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname", Issuer == "AD AUTHORITY"]
 => issue(store = "Active Directory", types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"), query = ";userPrincipalName,tokenGroups;{0}", param = c.Value);

 => issue(Type = "http://schemas.microsoft.com/authorization/claims/permit", Value = "true");
`,
  },
  {
    id: "ldap-profile",
    name: "LDAP — email, name, given/surname",
    description: "Send several common Active Directory attributes as claims.",
    rules: `@RuleTemplate = "LdapClaims"
@RuleName = "Send LDAP Attributes"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname", Issuer == "AD AUTHORITY"]
 => issue(store = "Active Directory", types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"), query = ";mail,givenName,sn;{0}", param = c.Value);
`,
  },
  {
    id: "passthrough-email",
    name: "Pass through — email",
    description: "Forward an incoming email claim unchanged.",
    rules: `@RuleTemplate = "PassThroughClaims"
@RuleName = "Pass Through Email"
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]
 => issue(claim = c);
`,
  },
  {
    id: "transform-upn-nameid",
    name: "Transform — UPN to Name ID",
    description: "Re-issue the UPN value as the SAML NameID.",
    rules: `@RuleTemplate = "MapClaims"
@RuleName = "UPN to Name ID"
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"]
 => issue(Type = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", Value = c.Value);
`,
  },
  {
    id: "strip-domain",
    name: "Transform — strip domain prefix",
    description: "Convert DOMAIN\\\\user into just the username with RegExReplace.",
    rules: `@RuleName = "Strip Domain Prefix"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname"]
 => issue(Type = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", Value = RegExReplace(c.Value, "(?i)^.*\\\\", ""));
`,
  },
  {
    id: "permit-all",
    name: "Authorization — permit everyone",
    description: "Allow every user to be issued a token.",
    rules: `@RuleName = "Permit Everyone"
 => issue(Type = "http://schemas.microsoft.com/authorization/claims/permit", Value = "true");
`,
  },
  {
    id: "permit-group",
    name: "Authorization — permit a specific group",
    description: "Only allow members of a group (matched by its SID).",
    rules: `@RuleName = "Permit Access Group"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid", Value == "S-1-5-21-1004336348-1177238915-682003330-1234"]
 => issue(Type = "http://schemas.microsoft.com/authorization/claims/permit", Value = "true");
`,
  },
  {
    id: "deny-group",
    name: "Authorization — deny a group",
    description: "Block members of a group from getting a token.",
    rules: `@RuleName = "Deny Blocked Group"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid", Value == "S-1-5-21-1004336348-1177238915-682003330-5678"]
 => issue(Type = "http://schemas.microsoft.com/authorization/claims/deny", Value = "true");
`,
  },
  {
    id: "default-role",
    name: "Default role when none exists",
    description: "Give users without any role claim a default role (NOT EXISTS).",
    rules: `@RuleName = "Default Role"
NOT EXISTS([Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"])
 => issue(Type = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", Value = "User");
`,
  },
  {
    id: "correlate",
    name: "Correlated conditions (&&)",
    description: "Issue a claim only when two different claims are both present.",
    rules: `@RuleName = "App Admin From Group"
c1:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", Value == "Administrators"]
 && c2:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"]
 => issue(Type = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role", Value = "AppAdmin");
`,
  },
  {
    id: "sql-store",
    name: "Custom store — SQL lookup",
    description: "Enrich claims from a custom SQL attribute store.",
    rules: `@RuleName = "Lookup Role From SQL"
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"]
 => issue(store = "Custom SQL Store", types = ("http://schemas.microsoft.com/ws/2008/06/identity/claims/role"), query = "SELECT role FROM AppUsers WHERE upn = {0}", param = c.Value);
`,
  },
  {
    id: "email-regex",
    name: "Conditional — only @contoso.com emails",
    description: "Pass through the email claim only when it matches a regex.",
    rules: `@RuleName = "Contoso Emails Only"
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", Value =~ "(?i)@contoso\\.com$"]
 => issue(claim = c);
`,
  },
];
