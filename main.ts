import { chromium } from 'npm:playwright@1.35.0'
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts'

const BASE_URL_LEFT = 'https://renoirboulanger.com'
const BASE_URL_RIGHT = 'https://renoirboulanger-com.pages.dev'
const INPUT_FILE = 'input.csv'
const OUTPUT_FILE = 'output.csv'
const OUTPUT_DIR = 'output'

async function takeScreenshot(url: string): Promise<Uint8Array> {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(url, { waitUntil: 'networkidle' })

  // Scroll to bottom to ensure all lazy-loaded content is loaded
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  // Wait a bit for any post-scroll loading
  await page.waitForTimeout(2000)

  const screenshot = await page.screenshot({ fullPage: true })

  await browser.close()

  return screenshot as Uint8Array
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

  // Fill with white background
  combined.fill(0xffffffff)

  // Paste images side by side
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
  url: string,
  paddingLength: number,
): Promise<string> {
  const leftUrl = new URL(url, BASE_URL_LEFT).toString()
  const rightUrl = new URL(url, BASE_URL_RIGHT).toString()

  console.log(
    `Processing ${lineNumber.toString().padStart(paddingLength, '0')}: ${url}`,
  )
  const [screenshot1, screenshot2] = await Promise.all([
    takeScreenshot(leftUrl),
    takeScreenshot(rightUrl),
  ])

  const outputFileName = normalizeFileName(lineNumber, url, paddingLength)
  const outputPath = `${OUTPUT_DIR}/${outputFileName}`
  await combineImages(screenshot1, screenshot2, outputPath)

  return outputFileName
}

async function readInputFile(): Promise<string[]> {
  const content = await Deno.readTextFile(INPUT_FILE)
  return content.split('\n').filter((line) => line.trim() !== '')
}

function getPaddingLength(totalLines: number): number {
  return Math.max(3, Math.floor(Math.log10(totalLines)) + 1)
}

async function readOutputFile(): Promise<Set<string>> {
  try {
    const content = await Deno.readTextFile(OUTPUT_FILE)
    const lines = content.split('\n').filter((line) => line.trim() !== '')
    return new Set(lines.map((line) => line.split(',')[0].trim()))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Set()
    }
    throw error
  }
}

async function appendToOutputFile(
  url: string,
  outputFileName: string,
): Promise<void> {
  await Deno.writeTextFile(OUTPUT_FILE, `${url},${outputFileName}\n`, {
    append: true,
  })
}

async function main() {
  try {
    await Deno.mkdir(OUTPUT_DIR, { recursive: true })
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error
    }
  }

  const urls = await readInputFile()
  const paddingLength = getPaddingLength(urls.length)
  const processedUrls = await readOutputFile()

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (!processedUrls.has(url)) {
      const outputFileName = await processUrl(i + 1, url, paddingLength)
      await appendToOutputFile(url, outputFileName)
    } else {
      console.log(`Skipping already processed URL: ${url}`)
    }
  }

  console.log('All URLs processed. Results saved in the output directory.')
}

if (import.meta.main) {
  main().catch(console.error)
}
