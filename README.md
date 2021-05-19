# Regex Merge

Github Action for multiple branches merging

## Inputs

### `accessToken`

**Required** Github token. Usually secrets.GITHUB_TOKEN.

### `headBranch`

**Required** Branch to merge.

### `excludeRegex`

Regex pattern for exclude all branchs that maches with

### `branchRegex`

Regex pattern for all branches to be updated.

### `notifyConflicts`

Comments in related PR to branch, notifying about the merge conflict.

## Example usage

```yaml
uses: TalissonBento/regex-merge@v1.0
with:
  accessToken: ${{ secrets.GITHUB_TOKEN }}
  headBranch: master
  excludeRegex: '^hotfix\/.+'
  branchRegex: '^release\/.+'
```