import lodash from "lodash";

export function id<T>(x: T): T {
  return lodash.identity(x);
}
