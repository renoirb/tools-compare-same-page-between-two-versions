import { chromium } from 'npm:playwright@1.35.0'
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts'
import { exists } from 'https://deno.land/std/fs/exists.ts'

const BASE_URL_LEFT = 'https://renoirboulanger.com'
const BASE_URL_RIGHT = 'https://renoirboulanger-com.pages.dev'
const INPUT_FILE = 'input.csv'
const OUTPUT_FILE = 'output.csv'
const OUTPUT_DIR = 'output'

async function takeScreenshot(
  url: string,
): Promise<{ image: Uint8Array; statusCode: number }> {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  let statusCode = 200
  page.on('response', (response) => {
    if (response.url() === url) {
      statusCode = response.status()
    }
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    const screenshot = (await page.screenshot({ fullPage: true })) as Uint8Array
    return { image: screenshot, statusCode }
  } catch (error) {
    console.error(`Error capturing screenshot for ${url}: ${error.message}`)
    return { image: await createErrorImage(statusCode), statusCode }
  } finally {
    await browser.close()
  }
}

async function createErrorImage(statusCode: number): Promise<Uint8Array> {
  const image = new Image(400, 300)
  image.fill(0xffffffff)
  image.drawText(20, 20, `Error: ${statusCode}`, 0xff0000ff, 'sans-serif', 24)
  return await image.encode()
}

async function combineImages(
  image1: Uint8Array,
  image2: Uint8Array,
  outputPath: string,
): Promise<void> {
  const img1 = await Image.decode(image1)
  const img2 = await Image.decode(image2)

  const maxWidth = Math.max(img1.width, img2.width)
  const maxHeight = Math.max(img1.height, img2.height)

  const combined = new Image(maxWidth * 2, maxHeight)
  combined.fill(0xffffffff)
  combined.composite(img1, 0, 0)
  combined.composite(img2, maxWidth, 0)

  await Deno.writeFile(outputPath, await combined.encode())
}

function normalizeFileName(
  lineNumber: number,
  url: string,
  paddingLength: number,
): string {
  const paddedNumber = lineNumber.toString().padStart(paddingLength, '0')
  const normalizedUrl = url
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
  return `${paddedNumber}-${normalizedUrl}.png`
}

async function processUrl(
  lineNumber: number,
  leftUrl: string,
  rightUrl: string,
  paddingLength: number,
): Promise<{ fileName: string; leftStatus: number; rightStatus: number }> {
  const fullLeftUrl = new URL(leftUrl, BASE_URL_LEFT).toString()
  const fullRightUrl = new URL(rightUrl, BASE_URL_RIGHT).toString()

  console.log(
    `Processing ${lineNumber
      .toString()
      .padStart(paddingLength, '0')}: ${leftUrl} | ${rightUrl}`,
  )
  const [leftResult, rightResult] = await Promise.all([
    takeScreenshot(fullLeftUrl),
    takeScreenshot(fullRightUrl),
  ])

  const outputFileName = normalizeFileName(lineNumber, leftUrl, paddingLength)
  const outputPath = `${OUTPUT_DIR}/${outputFileName}`
  await combineImages(leftResult.image, rightResult.image, outputPath)

  return {
    fileName: outputFileName,
    leftStatus: leftResult.statusCode,
    rightStatus: rightResult.statusCode,
  }
}

function getPaddingLength(totalLines: number): number {
  return Math.max(3, Math.floor(Math.log10(totalLines)) + 1)
}

async function readInputFile(): Promise<
  Array<{ leftUrl: string; rightUrl: string }>
> {
  const content = await Deno.readTextFile(INPUT_FILE)
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [leftUrl, rightUrl = leftUrl] = line
        .split(',')
        .map((url) => url.trim())
      return { leftUrl, rightUrl }
    })
}

async function appendToOutputFile(
  lineNumber: number,
  leftUrl: string,
  rightUrl: string,
  outputFileName: string,
  leftStatus: number,
  rightStatus: number,
): Promise<void> {
  await Deno.writeTextFile(
    OUTPUT_FILE,
    `${lineNumber},${leftUrl},${rightUrl},${outputFileName},${leftStatus},${rightStatus}\n`,
    { append: true },
  )
}

async function main() {
  try {
    await Deno.mkdir(OUTPUT_DIR, { recursive: true })
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error
    }
  }

  const urlPairs = await readInputFile()
  const paddingLength = getPaddingLength(urlPairs.length)

  for (let i = 0; i < urlPairs.length; i++) {
    const lineNumber = i + 1
    const { leftUrl, rightUrl } = urlPairs[i]
    const outputFileName = normalizeFileName(lineNumber, leftUrl, paddingLength)
    const outputPath = `${OUTPUT_DIR}/${outputFileName}`

    if (await exists(outputPath)) {
      console.log(`Skipping already processed URL: ${leftUrl}`)
      continue
    }

    const { fileName, leftStatus, rightStatus } = await processUrl(
      lineNumber,
      leftUrl,
      rightUrl,
      paddingLength,
    )
    await appendToOutputFile(
      lineNumber,
      leftUrl,
      rightUrl,
      fileName,
      leftStatus,
      rightStatus,
    )
  }

  console.log('All URLs processed. Results saved in the output directory.')
}

if (import.meta.main) {
  main().catch(console.error)
}
