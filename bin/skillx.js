#!/usr/bin/env node
import { main } from "../dist/cli.mjs";

const code = await main(process.argv.slice(2));
process.exitCode = code;
