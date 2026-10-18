import { runConformanceChecks } from '@chipzen-ai/bot';
import { ArenaBot } from '../src/arena/bot';

const checks = await runConformanceChecks(new ArenaBot());
for (const check of checks) console.log(`${check.severity.toUpperCase()} ${check.name}: ${check.message}`);
if (checks.some(c => c.severity === 'fail')) process.exitCode = 1;
