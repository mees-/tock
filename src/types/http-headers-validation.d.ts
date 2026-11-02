declare module "http-headers-validation" {
  const api: {
    validateHeaderName(name: string): boolean
    validateHeaderValue(value: string): boolean
    validateHeader(name: string, value: string): boolean
  }
  export = api
}
