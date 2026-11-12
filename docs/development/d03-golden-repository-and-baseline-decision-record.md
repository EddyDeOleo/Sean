# Sean — D03 Golden Repository and Baseline Decision Record

**Gate:** D03 (Spec 1 §19 and §24; Architecture §25 item 9; Spec 1 §25 "Golden Test repository and baseline strategy defined").
**Investigation date:** 2026-11-10.
**Method:** public, read-only GitHub REST API requests and public documentation. No repository was cloned. No dependency was installed. No test was run.

## Status

| Item | Status |
|---|---|
| Golden repository | `django/django`. **Approved by the owner.** |
| Baseline strategy | Defined in this record: immutable release tag, resolved to a commit SHA, verified before use. |
| Approved baseline | Django 5.2 final, tag `5.2`, commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`. **Approved by the owner.** |
| Golden cases G01 to G10 | Not selected or implemented. Their selection is part of D04 and task 18 of the native Evidence Retrieval plan. |
| D03 overall | **APPROVED (repository and commit).** Golden cases remain open under D04. |

The baseline is pinned to the approved SHA. Golden tests may use it only after D04 selects and verifies the cases and the Golden fixture is created (Spec 1 §19). Tests must reference the SHA, never the branch or tag name.

## 1. Repository identity

- Name: `django/django`.
- Canonical URL: `https://github.com/django/django` (clone URL `https://github.com/django/django.git`).
- Default branch: `main`.
- Visibility: public. Not archived.
- Repository license: BSD-3-Clause. This is the upstream project's license. It is separate from Sean's MIT license.
- Pull requests: enabled (`has_pull_requests: true`).
- GitHub Issues: **disabled** (`has_issues: false`). Django tracks its issues in its own Trac system. See section 6.
- Size: about 284 MB as reported by the API. Full history is required, so shallow clones are not acceptable.

Source: `GET https://api.github.com/repos/django/django`.

## 2. Candidate baselines

| Candidate | Reference type | Commit SHA | Commit date (UTC, from the commit object) | Assessment |
|---|---|---|---|---|
| Django 5.2 final | Annotated, signed tag `5.2` (tag object `6b995cff697d35d13ab876f2d0b19bc6fc835d8e`) | `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0` | 2025-04-02T12:56:34Z (`[5.2.x] Bumped version for 5.2 release.`) | **Recommended** |
| Django 6.0 final | Annotated, signed tag `6.0` (tag object `f975e4d6c92880dfd27ee4e995b5708c702cd46a`) | `36b5f39d9372147f0e758f590e35ee2b2bc317dd` | 2025-12-03T16:20:45Z (`[6.0.x] Bumped version for 6.0 release.`) | Alternative. Newer, and not an LTS line. |
| `stable/5.2.x` | Branch-style ref listed under tags | Changes as patch releases land | Not applicable | **Rejected.** It is a moving reference, not a baseline. |

The tag objects report a verified signature in the API response. Local signature verification was not performed.

Sources: `GET /repos/django/django/git/matching-refs/tags/5.2`, `GET /repos/django/django/git/matching-refs/tags/6.`, `GET /repos/django/django/git/tags/6b995cff697d35d13ab876f2d0b19bc6fc835d8e`, `GET /repos/django/django/git/tags/f975e4d6c92880dfd27ee4e995b5708c702cd46a`, `GET /repos/django/django/commits/9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`, `GET /repos/django/django/commits/36b5f39d9372147f0e758f590e35ee2b2bc317dd`.

## 3. Recommendation and rationale

Django 5.2 is recommended for these reasons:

1. **Immutable reference.** The baseline is a signed release tag resolved to one commit. A commit SHA names fixed content, and the tag is not a moving branch.
2. **Long-term support line.** Django's 5.2 release notes describe it as a long-term support release with security updates for at least three years. Support for 5.2 is stated to end in April 2028 (`https://docs.djangoproject.com/en/5.2/releases/5.2/`; `https://endoflife.date/django`).
3. **Deep history.** The file histories at this commit contain 2024 and 2025 commits, which gives Sean a long timeline to test.
4. **Traceable backports.** Commit messages use the `[5.2.x] Fixed #NNNNN` convention. These give provenance chains between a stable-branch commit and its main-branch origin (section 4, item 3).

Django 6.0 is a valid alternative. Its tag is also immutable. The owner chooses between the two when approving the SHA. This record recommends 5.2.

## 4. Verified history examples

These are commit objects read through the API at the baseline. They show that the history is present. They do not yet establish the Golden expectations, which D04 must verify.

| # | Mechanism | File | Commit (full SHA) | Dates (UTC) | What the message states |
|---|---|---|---|---|---|
| 1 | Default password-hash iteration count | `django/contrib/auth/hashers.py` | `04a208d7f19f393ad92ba7cef31842318be2d38a` | Author 2024-05-03, committer 2024-05-22 | Increases the default PBKDF2 iterations "for Django 5.2". No rationale or ticket is stated in the message. |
| 2 | Timing of password verification for unusable passwords | `django/contrib/auth/hashers.py` | `5d8645857936c142a3973694799c52165e2bdcdb` | Author 2024-06-15, committer 2024-07-09 | A security fix tied to a CVE, with a reference to ticket #20760. |
| 3 | Tuple-valued subquery lookups | `django/db/models/query.py` | `dc1c9b4ddd3ca64279da7c97b5023fbedf2340e2` | Author 2025-01-28, committer 2025-02-11 | A `[5.2.x]` backport of ticket #36149. The message names main-branch commit `41239fe34d64e801212dccaa4585e4802d0fac68` as its origin. That origin commit was not retrieved in this record. |

Items 1 to 3 are not themselves Golden cases. They show the kinds of evidence that Sean must distinguish.

## 5. Candidate questions

These questions are hypotheses for D04 and the Golden case design. Each expected classification is a prediction to verify, not an accepted expectation.

| # | Question | Expected evidence | Expected classification (to verify) | Known limitation |
|---|---|---|---|---|
| Q1 | Why was the default PBKDF2 iteration count increased for Django 5.2? | Commit 1 in section 4 documents the change. | `PARTIAL_EVIDENCE` for the reason, since the change is documented but the reason is not. This checks that Sean does not infer intent. | No rationale or ticket appears in the message. |
| Q2 | What did the change to verification of unusable passwords fix, and which ticket records it? | Commit 2 in section 4 describes the CVE fix and references ticket #20760. | `DOCUMENTED` for the described change. | The ticket itself is in Trac and is not retrievable through GitHub. |
| Q3 | Where did the tuple-subquery fix in the 5.2 line originate? | Commit 3 in section 4 and its main-branch origin `41239fe34d64e801212dccaa4585e4802d0fac68`. | `DOCUMENTED` for the backport relationship, once the origin commit is retrieved. | Retrieval must follow a stated origin that is not in the baseline's ancestry. This is unverified. |

## 6. Known limitations and missing evidence

1. **GitHub Issues are disabled.** `get_issue` cannot retrieve GitHub issues for this repository. The issue references in commit messages are Trac tickets (for example `#36149` and `#20760`), which are outside the approved sources. This is a documented limitation, not a reason to add a Trac integration. Adding one would be a new external source and needs approval.
2. **Pull-request association is unverified.** The repository has pull requests enabled, but the commit messages examined use Trac-style references, not pull-request numbers. Whether GitHub's commit-to-pull-request association returns useful results is a D04 question.
3. **Backports can point outside the baseline's ancestry.** Retrieval must handle an origin commit that is on another branch.
4. **Golden categories are not yet covered.** Deletion, rename or move, revert, replacement, ambiguous context, partial retrieval, and insufficient evidence (Spec 1 §19) are not yet demonstrated in this baseline. They must be selected and verified against commits in D04.
5. **Full history is required.** A shallow clone (`--depth`) would remove the history that Golden tests need.
6. **Windows path length is unverified.** A checkout may hit long-path limits. If it does, the fix must be applied to the fixture clone only, and it must be recorded. It is not verified here.
7. **Local signature verification was not performed.** The API reports the tag signature as verified.

## 7. Reproduction on Windows

Run these commands in PowerShell. The fixture must be outside the Sean repository and must never be used as the repository under test.

```powershell
$golden = Join-Path $env:LOCALAPPDATA 'Sean\golden\django'
New-Item -ItemType Directory -Force -Path (Split-Path $golden) | Out-Null
git clone --no-checkout https://github.com/django/django.git $golden
git -C $golden rev-parse --is-shallow-repository                  # expect: false
git -C $golden rev-parse --verify "9e7cc2b628fe8fd3895986af9b7fc9525034c1b0^{commit}"
git -C $golden checkout --detach 9e7cc2b628fe8fd3895986af9b7fc9525034c1b0
git -C $golden rev-parse HEAD                                     # expect: 9e7cc2b628fe8fd3895986af9b7fc9525034c1b0
git -C $golden rev-parse "5.2^{commit}"                           # expect: the same SHA
```

These commands are a procedure. They are not run in this record. Running them is a separate, authorized step at implementation time. Sean's Git subprocess rules still apply to the fixture: no repository hooks, no fetch or write operations during investigation, and no modification of the fixture.

## 8. Immutability and availability

- A commit SHA identifies fixed content. The SHA does not change, and the tag `5.2` names it.
- Availability depends on the upstream repository continuing to host the objects. The SHA is the durable identifier. If the upstream becomes unavailable, the fixture cannot be rebuilt from GitHub.
- An optional offline bundle, created from the verified fixture and kept outside the repository, would protect against that. Creating it is an implementation-time decision, not part of this record.

## 9. Owner decision required

**Decision recorded:** the owner approved the SHA `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0` (Django 5.2 final, tag `5.2`) as the Golden baseline. The alternative `36b5f39d9372147f0e758f590e35ee2b2bc317dd` (Django 6.0) was not selected.

## 10. Documents and tasks updated by this record

- Native Evidence Retrieval Spec: Requirement 22.1, the Golden section of `design.md`, the open-decision row for E-D9, and task 18.1 (these still need the approved-SHA wording; see the closure report).
- D01 pending-gate table: the row for D03.
- Spec 1 §24 still lists D03 as "Pending". That is an approved source, and it was not edited. The owner decides whether to request an approved-source update.

## Sources

- `https://api.github.com/repos/django/django`
- `https://api.github.com/repos/django/django/git/matching-refs/tags/5.2`
- `https://api.github.com/repos/django/django/git/matching-refs/tags/6.`
- `https://api.github.com/repos/django/django/git/tags/6b995cff697d35d13ab876f2d0b19bc6fc835d8e`
- `https://api.github.com/repos/django/django/git/tags/f975e4d6c92880dfd27ee4e995b5708c702cd46a`
- `https://api.github.com/repos/django/django/commits/9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`
- `https://api.github.com/repos/django/django/commits/36b5f39d9372147f0e758f590e35ee2b2bc317dd`
- `https://api.github.com/repos/django/django/commits?sha=9e7cc2b628fe8fd3895986af9b7fc9525034c1b0&path=django/contrib/auth/hashers.py`
- `https://api.github.com/repos/django/django/commits?sha=9e7cc2b628fe8fd3895986af9b7fc9525034c1b0&path=django/db/models/query.py`
- `https://docs.djangoproject.com/en/5.2/releases/5.2/` (support statement, via search result)
- `https://endoflife.date/django` (support end date, via search result)
