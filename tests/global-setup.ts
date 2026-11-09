/**
 * Pin the process timezone so date-sensitive tests (e.g. lib/semester.ts uses
 * Date#getDay on a UTC+7-shifted Date) behave the same on every machine / CI.
 */
export default function setup() {
  process.env.TZ = 'UTC';
}
