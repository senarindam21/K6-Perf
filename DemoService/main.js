export {callList} from "../DemoService/service.js";

const configFile = JSON.parse(open("../DemoService/config/env.json"));

let env = `${__ENV.ENV}`;
let steadyState = (__ENV.STEADYSTATE);
let configJson = configFile[env];

let baseURL = configJson.url;

export {baseURL, configJson}

let perfscenarios = {
      LoadTest: {
        executor: 'ramping-arrival-rate',
        exec:"callList",
        startRate: 1 * 1,
        timeUnit: (1 * 1) + 's',
        preAllocatedVUs: 1,
        maxVUs: 5,
        stages: [
          { target: 1 * 1, duration: '10s' },
          { target: 1 * 1, duration: steadyState }
        ],
      },

      SingleUser: {
        executor: 'shared-iterations',
        exec: 'callList',
        vus: 1,
        iterations: 1,
        maxDuration: '30s'
      }
  };

  let LoadThresholds = {

    'http_req_duration{RT:T01_Transaction}': ['p(95) < 500'],
    'checks{Checks:T01_Transaction}': ['rate == 1'],
    'http_req_failed{FR:T01_Transaction}':['rate < 0'],
    'http_reqs{TPS: T01_Transaction}' : ['rate > 0'],

    'http_req_duration{RT:T02_Transaction}': ['p(95) < 500'],
    'checks{Checks:T02_Transaction}': ['rate == 1'],
    'http_req_failed{FR:T02_Transaction}':['rate < 0'],
    'http_reqs{TPS: T02_Transaction}' : ['rate > 0'],

    'http_req_duration{RT:T03_Transaction}': ['p(95) < 500'],
    'checks{Checks:T03_Transaction}': ['rate == 1'],
    'http_req_failed{FR:T03_Transaction}':['rate < 0'],
    'http_reqs{TPS: T03_Transaction}' : ['rate > 0'],

    'http_req_duration{RT:T04_Transaction}': ['p(95) < 500'],
    'checks{Checks:T04_Transaction}': ['rate == 1'],
    'http_req_failed{FR:T04_Transaction}':['rate < 0'],
    'http_reqs{TPS: T04_Transaction}' : ['rate > 0'],

    'http_req_duration{RT:T05_Transaction}': ['p(95) < 500'],
    'checks{Checks:T05_Transaction}': ['rate == 1'],
    'http_req_failed{FR:T05_Transaction}':['rate < 0'],
    'http_reqs{TPS: T05_Transaction}' : ['rate > 0']
  }

  export let options = {

    summaryTrendStats : ["min", "max", "avg", "p(95)", "p(99)", "count"],
    scenarios : {},
    thresholds : LoadThresholds
  }

  if(__ENV.scenario){

    options.scenarios[__ENV.scenario] = perfscenarios[__ENV.scenario];
  } else{
    options.scenarios = perfscenarios;
  }

  //k6 run main.js -e ENV=qa -e STEADYSTATE=30s -e scenario=SingleUser