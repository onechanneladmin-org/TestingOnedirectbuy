'use strict';

const path = require('path');

const BASE_URL = 'https://gibsonperformance.com/';
const ALLOWED_HOSTS = ['gibsonperformance.com', 'www.gibsonperformance.com'];

// Quick validation set (run with --sample): exhaust systems, a header, a tip, a
// black-finish system, and a part whose title and Item # disagree on the site.
const SAMPLE_MPNS = ['619001', '619633', '69553-B', 'GP309S-C', '500362', '619013', '70-0006'];

const OUTPUT_DIR = process.env.GIBSON_OUTPUT_DIR || path.join(__dirname, '..', 'output');
const DEFAULT_MPN_FILE = path.join(__dirname, '..', 'gibson_mpns.json');

module.exports = {
  BASE_URL,
  ALLOWED_HOSTS,
  SAMPLE_MPNS,
  OUTPUT_DIR,
  DEFAULT_MPN_FILE,
  NAV_TIMEOUT_MS: Number(process.env.GIBSON_NAV_TIMEOUT_MS || 45000),
  DELAY_MS: Number(process.env.GIBSON_DELAY_MS || 500),
};
