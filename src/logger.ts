import { proxyPath, isBrowser, EndpointType, getIngestURL, isVercel, isEnvVarsSet } from './shared';
import { throttle } from './shared';

const url = isBrowser ? `${proxyPath}/logs` : getIngestURL(EndpointType.logs);

const throttledSendLogs = throttle(sendLogs, 1000);
let logEvents: any[] = [];

function _log(level: string, message: string, args: any = {}) {
  if (!isEnvVarsSet) {
    // if AXIOM ingesting url is not set, fallback to printing to console
    // to avoid network errors in development environments
    console.log(`info - ${message}\n`, args);
    return;
  }

  const logEvent = { level, message, _time: new Date(Date.now()).toISOString() };
  if (Object.keys(args).length > 0) {
    logEvent['fields'] = args;
  }

  if (isVercel) {
    const body = JSON.stringify(logEvent);
    console.log(`AXIOM::LOG=${body}`);
  } else {
    logEvents.push(logEvent);
    throttledSendLogs();
  }
}

export const log = {
  debug: (message: string, args: any = {}) => _log('debug', message, args),
  info: (message: string, args: any = {}) => _log('info', message, args),
  warn: (message: string, args: any = {}) => _log('warn', message, args),
  error: (message: string, args: any = {}) => _log('error', message, args),
  flush: sendLogs,
};

async function sendLogs() {
  if (!logEvents.length) {
    return;
  }

  const method = 'POST';
  const keepalive = true;
  const body = JSON.stringify(logEvents);
  // clear pending logs
  logEvents = [];

  try {
    if (typeof fetch === 'undefined') {
      const fetch = await require('cross-fetch');
      await fetch(url, { body, method, keepalive });
    } else if (isBrowser && navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      await fetch(url, { body, method, keepalive });
    }
  } catch (e) {
    console.error(`Failed to send logs to Axiom: ${e}`);
  }
}
