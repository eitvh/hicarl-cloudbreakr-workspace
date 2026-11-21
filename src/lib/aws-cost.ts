// Singapore on-demand tier-1 USD rates, verified 2026-11-22.
// AWS public regional price lists: AWSLambda and AWSQueueService, ap-southeast-1.
// Scheduler: https://aws.amazon.com/eventbridge/pricing/ . Excludes free allowances.
export const AWS_RATES={x86:0.0000166667,arm:0.0000133334,lambdaRequest:0.0000002,standard:0.0000004,fifo:0.0000005,scheduler:0.000001} as const;
export function lambdaEstimate(gbSeconds:number,requests:number,architecture:'x86'|'arm'){
 if(!Number.isFinite(gbSeconds)||!Number.isFinite(requests)||gbSeconds<0||requests<0)throw Error('Usage must be non-negative and finite');
 const compute=gbSeconds*AWS_RATES[architecture],request=requests*AWS_RATES.lambdaRequest;
 return {compute,request,total:compute+request};
}
export function queueEstimate(standard:number,fifo:number){if(![standard,fifo].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid units');return standard*AWS_RATES.standard+fifo*AWS_RATES.fifo;}
export function schedulerEstimate(invocations:number,remainingAllowance=0){if(![invocations,remainingAllowance].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid units');return Math.max(0,invocations-remainingAllowance)*AWS_RATES.scheduler;}
