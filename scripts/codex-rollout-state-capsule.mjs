#!/usr/bin/env node
// CODEX_QUALITY_HARNESS_FILE v1.1.2

import { buildRolloutStateCapsule } from './codex-v112-conversation-surface.mjs';

console.log(JSON.stringify(buildRolloutStateCapsule(), null, 2));
