import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

export default octokit;
