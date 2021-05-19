const core = require("@actions/core");
const github = require("@actions/github");
var requestError = require("@octokit/request-error");

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const accessToken = core.getInput("accessToken");
const headBranch = core.getInput("headBranch");
let excludeRegex = core.getInput("excludeRegex");
let branchRegex = core.getInput("branchRegex");
const notifyConflicts = core.getInput("notifyConflicts");
const abortOnConflict = core.getInput("abortOnConflict");

const octokit = github.getOctokit(accessToken);
if (excludeRegex) {
  excludeRegex = new RegExp(excludeRegex);
  console.log(`Excluding those branchs matching with regex: ${excludeRegex}`);
}

if (branchRegex) {
  branchRegex = new RegExp(branchRegex);
  console.log(`Filtering braches with regex: ${branchRegex}`);
}

async function run() {
  let keepCheckingBranches = true;
  let currentPage = 1;
  while (keepCheckingBranches) {
    const { data: branches } = await octokit.repos.listBranches({
      owner: owner,
      repo: repo,
      page: currentPage,
    });
    console.log(`found ${branches.length} branches on page ${currentPage}`);

    for (const {name, commit: {sha}} of branches) {
      const validRegex = !branchRegex;
      const matched = name.match(branchRegex);
      if (excludeRegex && name.match(excludeRegex)) {
        console.log(`Branch ${name} was excluded from merge`);
        continue;
      }
      if (validRegex || matched) {
        try {
          await mergeToHead(name);
        } catch (e) {
          handleRequestError(e, name, sha);
          if (abortOnConflict) process.abort();
        }
      }
    }
    if (branches.length === 0) {
      keepCheckingBranches = false;
    } else {
      currentPage += 1;
    }
  }
}

async function mergeToHead(branch) {
  if (branch === headBranch) {
    return;
  }
  const { status, ...response } = await octokit.repos.merge({
    owner: owner,
    repo: repo,
    base: branch,
    head: headBranch,
  });
  switch (status) {
    case 201:
      console.log(`Merging ${headBranch} to ${branch} successful`);
      break;
    case 204:
      console.log(`Nothing to merge from ${headBranch} to ${branch}`);
      break;
    default:
      console.warn(`Merging ${headBranch} to ${branch}:`, response);
      break;
  }
}

function handleRequestError(error, branch, sha) {
  let msg;
  if (error instanceof requestError.RequestError) {
    if (error.status === 409) {
      commentInPr(branch, sha);
      msg = error.message;
    } else {
      msg = `[${error.status}] ${error.message}`;
    }
  } else {
    msg = error;
  }
  if (msg) {
    console.error(`Error merging ${headBranch} to ${branch}:`, msg);
  }
}

function commentInPr(branch, branchSha) {
  if (!notifyConflicts) {
    return;
  }
  octokit.pulls
    .list({
      owner: owner,
      repo: repo,
      state: "open",
      head: `${owner}:${branch}`,
    })
    .then(({ data }) => {
      const pr = data.find(({ head: { sha } }) => sha === branchSha);
      if (pr) {
        const msg = `@${pr.user.login} merge conflicts found.\nPlease merge master manually into this branch.`;
        console.log(
          `Merge conflict found for PR #${pr.number}. Notifying to @${pr.user.login}`
        );
        octokit.issues.createComment({
          owner: owner,
          repo: repo,
          issue_number: pr.number,
          body: msg,
        });
      }
    });
}

run();
