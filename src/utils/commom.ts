export const canOutput = true
export function logCat(tag: string, text: any, output = canOutput) {
  if (output) {
    console.log(tag, text)
  }
}
