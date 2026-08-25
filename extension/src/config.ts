declare const __WORKER_BASE_URL__:string;
export const WORKER_BASE_URL=(typeof __WORKER_BASE_URL__==='string'?__WORKER_BASE_URL__:'http://localhost:8787').replace(/\/$/,'');
