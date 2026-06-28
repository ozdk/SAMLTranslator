# SAML Translator

Make Microsoft **AD FS Claim Rules Language** easy to read, understand, and author.

AD FS claim rules look like this:

```
@RuleTemplate = "LdapClaims"
@RuleName = "UPN and Roles"
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname", Issuer == "AD AUTHORITY"]
 => issue(store = "Active Directory", types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"), query = ";userPrincipalName,tokenGroups;{0}", param = c.Value);
```

This tool turns that into plain English — and lets you build new rules from a friendly form.

## Features

### Translate
Paste claim rules and get a **When / Then** explanation for each rule:
- Long claim-type URIs collapse to friendly **pills** (UPN, Role, Windows account name…). Hover for the full URI and description; click to copy.
- Attribute-store queries are decoded to show the **attribute → claim-type mapping** (e.g. `userPrincipalName → UPN`, `tokenGroups → Role`) and what `{0}` is filled with.
- A **claim-flow diagram** shows incoming claim → this rule → outgoing claim.
- Parse errors point at the exact **line and column**.
- **Send to Build →** loads any translated rule into the editable builder.

### Build
Construct valid claim rules from a guided form, with a live, syntax-highlighted preview:
- **Send LDAP attributes** — look up attributes in Active Directory.
- **Transform via attribute store** — look up a value in a custom store (e.g. SQL) and issue it as a new claim.
- **Pass through a claim** — forward a claim unchanged.
- **Transform / map a claim** — re-issue a value under a different claim type.
- **Permit everyone** — issuance authorization rule.

The status badge reflects real validation, and Copy is disabled until the rule is complete.

## How it works

A framework-agnostic engine in [`src/lib`](src/lib) does the heavy lifting:

| File | Responsibility |
| --- | --- |
| `lexer.ts` | Tokenizes the claim rules language (`==` `!=` `=~` `!~` `&&` `=>`, verbatim strings). |
| `parser.ts` + `ast.ts` | Recursive-descent parser → typed AST. |
| `explain.ts` | AST → plain-English explanations. |
| `generate.ts` | AST → claim rules text (round-trips with the parser). |
| `claimTypes.ts` | Dictionary of well-known claim-type URIs. |
| `model.ts` | Builder presets. |

### Grammar notes
- Top-level conditions are joined with **`&&`** (commas separate property tests *inside* `[...]` and parameters *inside* `(...)`).
- String literals are **verbatim** — backslashes in regex patterns and queries are preserved exactly (`parse → generate → parse` is stable).

## Develop

```bash
npm install
npm run dev        # start the dev server
npm test           # run the engine test suite
npm run build      # type-check + production build
npm run preview    # preview the production build
```

The UI is React + TypeScript (Vite). The engine is plain TypeScript with a Vitest suite covering parsing, explanation, and round-trip generation.
