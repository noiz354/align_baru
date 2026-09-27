export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now() {
    return new Date();
  }
};

export function fixedClock(instant: Date): Clock {
  return { now: () => instant };
}
