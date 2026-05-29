// Thriva PDF text extraction. parseThriveReport and THRIVA_MARKERS added in HE-001 c2
// after lookup table is calibrated against real PDF output (see HE-001 c1 debug UI).

const WORKER_SRC = '/pdf.worker.min.mjs'

/**
 * Extracts reading-order text lines from a PDF File.
 * Groups text items by y-coordinate, sorts top-to-bottom then left-to-right,
 * so multi-column layouts are linearised correctly.
 * Returns string[] — one entry per visual line, empty lines filtered.
 */
export async function extractPdfLines(file) {
  const arrayBuffer = await file.arrayBuffer()

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC

  const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const lines = []

  console.log('PDF pages:', pdf.numPages)
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()
    console.log(`Page ${p}: rotation=${page.rotate}, viewport=${JSON.stringify(page.view)}, items=${content.items.length}`)
    if (content.items.length > 0) {
      console.log(`  First 3 items:`, content.items.slice(0, 3).map(i => ({
        str: i.str, transform: i.transform, width: i.width, height: i.height,
      })))
      console.log(`  Last 3 items:`, content.items.slice(-3).map(i => ({
        str: i.str, transform: i.transform,
      })))
    }

    const byY = {}
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      ;(byY[y] = byY[y] || []).push(item)
    }

    const sortedYs = Object.keys(byY).map(Number).sort((a, b) => b - a)
    for (const y of sortedYs) {
      const row = byY[y].sort((a, b) => a.transform[4] - b.transform[4])
      const str = row.map(i => i.str).join(' ').trim()
      if (str) lines.push(str)
    }
  }

  return lines
}
