'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import Link from 'next/link'

interface RowData {
  matchedProduct: string
  impressions: number
  clicks: number
  spend: number
  orders: number
  sales: number
  cpc: number
}

interface GroupStats {
  keyword: string
  occurrence: number
  impressions: number
  clicks: number
  ctr: number
  spend: number
  orders: number
  sales: number
  cpc: number
  acos: number
  roas: number
  conversionRate: number
}

interface NegativeGroupMatch {
  group: string
  terms: string[]
}

const threeDKeywordGroups = [
  { type: '3D', patterns: ['3d', '3-d', '3d card', '3-d card', '3d cards', '3-d cards'], exactWords: ['3d', '3-d'] },
  { type: 'Pop up', patterns: ['pop up', 'popup', 'pop-up', 'pop up card', 'popup card', 'pop-up card'], exactWords: ['pop', 'popup', 'pop-up'] },
  { type: 'Greeting card', patterns: ['greeting card', 'greeting cards', 'greetings card', 'greetings cards'], exactWords: ['greeting', 'greetings'] }
]

const negativeKeywordGroups = [
  {
    name: 'Music / Musical Light',
    keywords: ['music', 'musical', 'musical light', 'music light', 'musical-light']
  },
  {
    name: 'Gift Card / Amazon Card',
    keywords: ['gift card', 'giftcard', 'amazon card', 'amazon gift card', 'amazon giftcard']
  },
  {
    name: 'Credit Card',
    keywords: ['credit card', 'creditcard']
  }
]

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [groupedData, setGroupedData] = useState<GroupStats[]>([])
  const [threeDStats, setThreeDStats] = useState<GroupStats[]>([])
  const [negativeMatches, setNegativeMatches] = useState<NegativeGroupMatch[]>([])
  const [originalWorkbook, setOriginalWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [analysisSheetName, setAnalysisSheetName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Luôn sử dụng Exact Match
  const exactMatch = true

  const synonymGroups: { [key: string]: string[] } = {
    'fathers/ father/ father\'s/ dad': ['father', 'fathers', 'dad', 'dads', 'father\'s', 'fathers\'', 'fathersday', 'dadday'],
    'birthday': ['birthday', 'birthdays', 'birth'],
    'dragon/ dragons': ['dragon', 'dragons'],
    'men/ man/ male': ['men', 'man', 'male', 'mens', 'mans'],
    'women/ woman/ lady': ['women', 'woman', 'lady', 'ladies'],
    'son': ['son', 'sons'],
    'brother': ['brother', 'brothers'],
    'anime': ['anime'],
    'dungeons': ['dungeon', 'dungeons', 'dnd'],
    'cool': ['cool'],
    'in law': ['inlaw', 'in-law'],
    'husband': ['husband', 'husbands', 'from wife'],
    'wife': ['wife', 'wives', 'from husband'],
    'mom/ mama/ mother/ mothers': ['mom', 'moms', 'mama', 'mamas', 'mother', 'mothers', 'mommy', 'mommies'],
    'flower/ floral/ bouquet/ bloom': ['flower', 'flowers', 'floral', 'bouquet', 'bouquets', 'bloom', 'blooms', 'blossom', 'blossoms'],
    'nasty/ naughty/ dirty': ['nasty', 'naughty', 'dirty', 'dirtier', 'dirtiest'],
    'sister/ sis': ['sister', 'sisters', 'sis', 'sissy'],
    'aunt/ auntie': ['aunt', 'aunts', 'auntie', 'aunties'],
    'uncle/ uncles': ['uncle', 'uncles'],
    'grandmom/ grandmother': ['grandmom', 'grandmoms', 'grandmother', 'grandmothers', 'grandma', 'grandmas', 'granny', 'grannies'],
    'daughter/ daughters': ['daughter', 'daughters'],
    'card': ['card', 'cards'],
    'pop': ['pop', 'popup', 'pop-up'],
    'greeting': ['greeting', 'greetings'],
    'funny/ hilarious/ humor/ humorous/ fun/ sarcastic/ joke': ['funny', 'hilarious', 'humor', 'humorous', 'fun', 'sarcastic', 'joke', 'jokes', 'joking', 'humorously', 'funnily'],
    'girl/ girls': ['girl', 'girls'],
    'kid/ kids/ child/ baby/ toddler': ['kid', 'kids', 'child', 'children', 'baby', 'babies', 'toddler', 'toddlers'],
  }

  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'out', 'is', 'are', 'was', 'were', '3d', '3-d']

  const normalizeWord = (word: string): string => {
    return word.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  }

  const isExactWord = (text: string, word: string): boolean => {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    return regex.test(text)
  }

  const matchesKeyword = (text: string, keyword: string): boolean => {
    if (keyword.includes(' ')) {
      const escapedParts = keyword
        .split(/\s+/)
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+')
      const phraseRegex = new RegExp(`\\b${escapedParts}\\b`, 'i')
      return phraseRegex.test(text)
    }
    return isExactWord(text, keyword)
  }

  const extractWords = (text: string): string[] => {
    return text.toLowerCase()
      .split(/[\s\-_\/\\,;.]+/)
      .map(word => word.replace(/[^a-z0-9']/g, ''))
      .filter(word => word.length > 0 && !stopWords.includes(word))
  }

  const matchesThreeDGroup = (text: string, group: (typeof threeDKeywordGroups)[number], isExactWordFn: (text: string, word: string) => boolean) => {
    const normalizedText = text.toLowerCase()
    if (group.patterns.some(pattern => normalizedText.includes(pattern))) {
      return true
    }

    if (group.exactWords && group.exactWords.some(word => isExactWordFn(normalizedText, word))) {
      return true
    }

    return false
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed', e.target.files)
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      console.log('Selected file:', selectedFile.name, selectedFile.type)
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile)
        setError(null)
        setGroupedData([])
        setThreeDStats([])
        setNegativeMatches([])
        setOriginalWorkbook(null)
        setAnalysisSheetName('')
        console.log('File accepted:', selectedFile.name)
      } else {
        setError('Vui lòng chọn file Excel (.xlsx hoặc .xls)')
        console.log('Invalid file type')
      }
    } else {
      console.log('No file selected')
    }
  }

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }
    return 0
  }

  const analyzeFile = async () => {
    if (!file) {
      setError('Vui lòng chọn file Excel!')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      setOriginalWorkbook(workbook)

      const sheetName = workbook.SheetNames.includes('Combined Data')
        ? 'Combined Data'
        : workbook.SheetNames[0]
      setAnalysisSheetName(sheetName)

      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      if (jsonData.length < 2) {
        setError('File không có dữ liệu!')
        setProcessing(false)
        return
      }

      const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim())
      const matchedProductIndex = headers.findIndex((h: string) => {
        // Tìm "Matched product" hoặc "Customer search term"
        return (h.includes('matched') && h.includes('product')) ||
          (h.includes('customer') && h.includes('search') && h.includes('term'))
      })
      const impressionsIndex = headers.findIndex((h: string) => h.includes('impression'))
      const clicksIndex = headers.findIndex((h: string) => h.includes('click'))
      const spendIndex = headers.findIndex((h: string) => h.includes('spend'))
      const ordersIndex = headers.findIndex((h: string) => h.includes('order'))
      const salesIndex = headers.findIndex((h: string) => h.includes('sales'))
      const cpcIndex = headers.findIndex((h: string) => h.includes('cpc'))

      const wordToRows: { [key: string]: Set<number> } = {}
      const threeDTypeRows = threeDKeywordGroups.reduce<Record<string, Set<number>>>((acc, item) => {
        acc[item.type] = new Set<number>()
        return acc
      }, {})
      const negativeKeywordTerms = negativeKeywordGroups.reduce<Record<string, Set<string>>>((acc, item) => {
        acc[item.name] = new Set<string>()
        return acc
      }, {})

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0) continue

        const matchedProduct = String(row[matchedProductIndex] || '').toLowerCase().trim()
        if (!matchedProduct) continue

        threeDKeywordGroups.forEach(group => {
          if (matchesThreeDGroup(matchedProduct, group, isExactWord)) {
            threeDTypeRows[group.type].add(i)
          }
        })

        negativeKeywordGroups.forEach(group => {
          if (group.keywords.some(keyword => matchesKeyword(matchedProduct, keyword))) {
            negativeKeywordTerms[group.name].add(String(row[matchedProductIndex] || '').trim())
          }
        })

        const groupsInThisRow = new Set<string>()

        if (exactMatch) {
          // Tập hợp các từ đã được xử lý bởi cụm từ (để tránh đếm trùng)
          const processedWords = new Set<string>()
          const matchedGroups = new Set<string>()

          // Bước 1: Kiểm tra các cụm từ trước (ưu tiên cao nhất)
          for (const [groupName, keywords] of Object.entries(synonymGroups)) {
            // Kiểm tra các cụm từ (có khoảng trắng) trước
            const phraseKeywords = keywords.filter(k => k.includes(' '))
            for (const k of phraseKeywords) {
              if (matchesKeyword(matchedProduct, k)) {
                matchedGroups.add(groupName)
                groupsInThisRow.add(groupName)
                // Đánh dấu các từ trong cụm đã được xử lý
                const phraseWords = k.toLowerCase().split(/\s+/)
                phraseWords.forEach(w => {
                  const normalized = normalizeWord(w)
                  if (normalized && !stopWords.includes(w)) {
                    processedWords.add(normalized)
                  }
                })
                break
              }
            }
          }

          // Bước 2: Kiểm tra các từ đơn (chỉ nếu nhóm chưa được match)
          for (const [groupName, keywords] of Object.entries(synonymGroups)) {
            if (matchedGroups.has(groupName)) continue // Bỏ qua nếu đã match cụm từ

            const singleKeywords = keywords.filter(k => !k.includes(' '))
            for (const k of singleKeywords) {
              if (matchesKeyword(matchedProduct, k)) {
                groupsInThisRow.add(groupName)
                // Đánh dấu từ đó đã được xử lý
                const normalized = normalizeWord(k)
                if (normalized) {
                  processedWords.add(normalized)
                }
                break // Chỉ cần một từ trong nhóm khớp là đủ
              }
            }
          }

          // Sau đó trích xuất các từ riêng lẻ và kiểm tra (chỉ các từ chưa được xử lý)
          const words = extractWords(matchedProduct)
          words.forEach(word => {
            if (!stopWords.includes(word)) {
              const normalizedWord = normalizeWord(word)

              // Bỏ qua nếu từ này đã được xử lý bởi cụm từ
              if (processedWords.has(normalizedWord)) {
                return
              }

              let inSynonymGroup = false
              // Kiểm tra xem từ này có nằm trong nhóm đồng nghĩa nào không
              for (const [groupName, keywords] of Object.entries(synonymGroups)) {
                // Chỉ kiểm tra các từ đơn (không phải cụm từ) để tránh trùng lặp
                if (keywords.some(k => {
                  if (k.includes(' ')) return false // Bỏ qua cụm từ
                  const normalizedK = normalizeWord(k)
                  return normalizedK === normalizedWord
                })) {
                  // Nếu từ này nằm trong nhóm đồng nghĩa, thêm nhóm vào (nếu chưa có)
                  if (!groupsInThisRow.has(groupName)) {
                    groupsInThisRow.add(groupName)
                  }
                  inSynonymGroup = true
                  break
                }
              }
              // Chỉ thêm từ riêng lẻ nếu nó không nằm trong nhóm đồng nghĩa nào
              if (!inSynonymGroup) {
                groupsInThisRow.add(normalizedWord)
              }
            }
          })
        } else {
          for (const [groupName, keywords] of Object.entries(synonymGroups)) {
            if (keywords.some(k => matchedProduct.includes(k.toLowerCase()))) {
              groupsInThisRow.add(groupName)
            }
          }

          const words = extractWords(matchedProduct)
          words.forEach(word => {
            if (!stopWords.includes(word)) {
              let inSynonymGroup = false
              for (const [, keywords] of Object.entries(synonymGroups)) {
                if (keywords.some(k => normalizeWord(k) === normalizeWord(word) || word.includes(normalizeWord(k)))) {
                  inSynonymGroup = true
                  break
                }
              }
              if (!inSynonymGroup) {
                groupsInThisRow.add(normalizeWord(word))
              }
            }
          })
        }

        groupsInThisRow.forEach(groupName => {
          if (!wordToRows[groupName]) {
            wordToRows[groupName] = new Set()
          }
          wordToRows[groupName].add(i)
        })
      }

      const groups: { [key: string]: { rows: RowData[], occurrence: number } } = {}

      for (const [word, rowIndices] of Object.entries(wordToRows)) {
        const rows: RowData[] = []

        rowIndices.forEach(i => {
          const row = jsonData[i]
          rows.push({
            matchedProduct: String(row[matchedProductIndex] || ''),
            impressions: parseNumber(row[impressionsIndex]),
            clicks: parseNumber(row[clicksIndex]),
            spend: parseNumber(row[spendIndex]),
            orders: parseNumber(row[ordersIndex]),
            sales: parseNumber(row[salesIndex]),
            cpc: parseNumber(row[cpcIndex])
          })
        })

        groups[word] = {
          rows: rows,
          occurrence: rowIndices.size
        }
      }

      const stats: GroupStats[] = []

      const allUniqueRows = new Set<number>()
      Object.values(wordToRows).forEach(rowSet => {
        rowSet.forEach(rowIndex => allUniqueRows.add(rowIndex))
      })

      const totalRows: RowData[] = []
      allUniqueRows.forEach(i => {
        const row = jsonData[i]
        totalRows.push({
          matchedProduct: String(row[matchedProductIndex] || ''),
          impressions: parseNumber(row[impressionsIndex]),
          clicks: parseNumber(row[clicksIndex]),
          spend: parseNumber(row[spendIndex]),
          orders: parseNumber(row[ordersIndex]),
          sales: parseNumber(row[salesIndex]),
          cpc: parseNumber(row[cpcIndex])
        })
      })

      const totalOccurrence = allUniqueRows.size
      const totalStats = calculateGroupStats('Total', totalRows, totalOccurrence)
      stats.push(totalStats)

      for (const [groupName, data] of Object.entries(groups)) {
        const groupStats = calculateGroupStats(groupName, data.rows, data.occurrence)
        stats.push(groupStats)
      }

      const total = stats[0]
      const others = stats.slice(1).sort((a, b) => b.occurrence - a.occurrence)

      setGroupedData([total, ...others])
      const threeDStatsResults: GroupStats[] = threeDKeywordGroups.map(group => {
        const rows: RowData[] = []
        threeDTypeRows[group.type].forEach(index => {
          const row = jsonData[index]
          rows.push({
            matchedProduct: String(row[matchedProductIndex] || ''),
            impressions: parseNumber(row[impressionsIndex]),
            clicks: parseNumber(row[clicksIndex]),
            spend: parseNumber(row[spendIndex]),
            orders: parseNumber(row[ordersIndex]),
            sales: parseNumber(row[salesIndex]),
            cpc: parseNumber(row[cpcIndex])
          })
        })
        return calculateGroupStats(group.type, rows, rows.length)
      })
      setThreeDStats(threeDStatsResults)

      const negativeResults: NegativeGroupMatch[] = negativeKeywordGroups
        .map(group => ({
          group: group.name,
          terms: Array.from(negativeKeywordTerms[group.name])
            .filter(term => term.length > 0)
            .sort((a, b) => a.localeCompare(b))
        }))
        .filter(item => item.terms.length > 0)

      setNegativeMatches(negativeResults)
      setProcessing(false)
    } catch (err) {
      console.error('Error analyzing file:', err)
      setError('Có lỗi xảy ra khi phân tích file!')
      setProcessing(false)
    }
  }

  const calculateGroupStats = (groupName: string, rows: RowData[], occurrence: number): GroupStats => {
    const impressions = rows.reduce((sum, r) => sum + r.impressions, 0)
    const clicks = rows.reduce((sum, r) => sum + r.clicks, 0)
    const spend = rows.reduce((sum, r) => sum + r.spend, 0)
    const orders = rows.reduce((sum, r) => sum + r.orders, 0)
    const sales = rows.reduce((sum, r) => sum + r.sales, 0)

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    const acos = sales > 0 ? (spend / sales) * 100 : 0
    const roas = spend > 0 ? sales / spend : 0
    const conversionRate = clicks > 0 ? (orders / clicks) * 100 : 0

    return {
      keyword: groupName,
      occurrence,
      impressions,
      clicks,
      ctr,
      spend,
      orders,
      sales,
      cpc,
      acos,
      roas,
      conversionRate
    }
  }

  const downloadResults = async () => {
    if (groupedData.length === 0 || !file) return

    let workbookToUse = originalWorkbook

    if (!workbookToUse) {
      const arrayBuffer = await file.arrayBuffer()
      workbookToUse = XLSX.read(arrayBuffer, { type: 'array' })
    }

    if (!workbookToUse) return

    const finalWorkbook = XLSX.utils.book_new()
    let appendedSummary = false

    workbookToUse.SheetNames.forEach(sheetName => {
      const sheet = workbookToUse?.Sheets[sheetName]
      if (!sheet) return
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][]
      const clonedSheet = XLSX.utils.aoa_to_sheet(sheetData)

      if (!appendedSummary && sheetName === analysisSheetName) {
        const range = XLSX.utils.decode_range(clonedSheet['!ref'] ?? 'A1')
        const startCol = range.e.c + 3
        let currentRow = 0

        const ensureCols = (extraCols: number) => {
          if (!clonedSheet['!cols']) clonedSheet['!cols'] = []
          const targetLength = startCol + extraCols
          for (let i = clonedSheet['!cols'].length; i <= targetLength; i++) {
            clonedSheet['!cols'][i] = clonedSheet['!cols'][i] ?? { wch: 14 }
          }
        }

        const applyTableBorder = (sheetRef: XLSX.WorkSheet, startRow: number, startColumn: number, rowCount: number, columnCount: number) => {
          const lastRow = startRow + rowCount - 1
          const lastCol = startColumn + columnCount - 1
          const thinBorder = { style: 'thin', color: { rgb: 'FFD1D5DB' } }

          for (let r = startRow; r <= lastRow; r++) {
            for (let c = startColumn; c <= lastCol; c++) {
              const addr = XLSX.utils.encode_cell({ r, c })
              if (!sheetRef[addr]) {
                sheetRef[addr] = { t: 's', v: '' }
              }
              const cell = sheetRef[addr]
              const existingStyle = cell.s ?? {}
              const border = existingStyle.border ? { ...existingStyle.border } : {}
              if (r === startRow) border.top = thinBorder
              if (r === lastRow) border.bottom = thinBorder
              if (c === startColumn) border.left = thinBorder
              if (c === lastCol) border.right = thinBorder
              cell.s = { ...existingStyle, border }
            }
          }
        }

        const threeDRows = threeDStats.map(item => [
          item.keyword,
          item.occurrence,
          item.impressions,
          item.clicks,
          `${item.ctr.toFixed(2)}%`,
          item.spend.toFixed(2),
          item.orders,
          item.sales.toFixed(2),
          item.cpc.toFixed(2),
          `${item.acos.toFixed(2)}%`,
          item.roas.toFixed(2),
          `${item.conversionRate.toFixed(1)}%`
        ])

        if (threeDRows.length > 0) {
          const threeDHeaderRow = ['Hiệu suất Loại thiệp 3D']
          ensureCols(12)
          const titleRow = currentRow
          XLSX.utils.sheet_add_aoa(clonedSheet, [threeDHeaderRow], { origin: { r: titleRow, c: startCol } })
          currentRow += 2

          const threeDTableStartRow = currentRow

          XLSX.utils.sheet_add_aoa(clonedSheet, [
            ['Loại thiệp 3D', 'Occurrence', 'Impressions', 'Clicks', 'CTR', 'Spend(USD)', 'Orders', 'Sales(USD)', 'CPC(USD)', 'ACOS', 'ROAS', 'Conversion rate']
          ], { origin: { r: threeDTableStartRow, c: startCol } })
          currentRow += 1

          XLSX.utils.sheet_add_aoa(clonedSheet, threeDRows, { origin: { r: currentRow, c: startCol } })
          currentRow += threeDRows.length

          const totals = threeDStats.reduce((acc, item) => {
            acc.occurrence += item.occurrence
            acc.impressions += item.impressions
            acc.clicks += item.clicks
            acc.spend += item.spend
            acc.orders += item.orders
            acc.sales += item.sales
            return acc
          }, { occurrence: 0, impressions: 0, clicks: 0, spend: 0, orders: 0, sales: 0 })

          XLSX.utils.sheet_add_aoa(clonedSheet, [[
            'Tổng',
            totals.occurrence,
            totals.impressions,
            totals.clicks,
            totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : '0.00%',
            totals.spend.toFixed(2),
            totals.orders,
            totals.sales.toFixed(2),
            totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0.00',
            totals.sales > 0 ? `${((totals.spend / totals.sales) * 100).toFixed(2)}%` : '0.00%',
            totals.spend > 0 ? (totals.sales / totals.spend).toFixed(2) : '0.00',
            totals.clicks > 0 ? `${((totals.orders / totals.clicks) * 100).toFixed(1)}%` : '0.0%'
          ]], { origin: { r: currentRow, c: startCol } })

          applyTableBorder(clonedSheet, threeDTableStartRow, startCol, threeDRows.length + 2, 12)

          currentRow += 2
        }

        if (negativeMatches.length > 0) {
          const negativeTitleRow = currentRow
          ensureCols(1)
          XLSX.utils.sheet_add_aoa(clonedSheet, [['Từ khóa Negative']], { origin: { r: negativeTitleRow, c: startCol } })
          currentRow += 2

          const negativeTerms = Array.from(new Set(
            negativeMatches.flatMap(item => item.terms)
          )).sort((a, b) => a.localeCompare(b))

          if (negativeTerms.length > 0) {
            const headerRow = currentRow
            XLSX.utils.sheet_add_aoa(clonedSheet, [['Negative']], { origin: { r: headerRow, c: startCol } })

            const headerAddr = XLSX.utils.encode_cell({ r: headerRow, c: startCol })
            const headerCell = clonedSheet[headerAddr] ?? { t: 's', v: 'Negative' }
            headerCell.s = {
              ...(headerCell.s ?? {}),
              font: { bold: true, color: { rgb: '000000' } },
              fill: { patternType: 'solid', fgColor: { rgb: 'FFF5B8' } },
              alignment: { horizontal: 'center' }
            }
            clonedSheet[headerAddr] = headerCell

            currentRow += 1

            negativeTerms.forEach((term, idx) => {
              const cellAddr = XLSX.utils.encode_cell({ r: currentRow + idx, c: startCol })
              clonedSheet[cellAddr] = {
                t: 's',
                v: term,
                s: {
                  fill: { patternType: 'solid', fgColor: { rgb: 'FFFED4' } },
                  alignment: { horizontal: 'left' }
                }
              }
            })

            currentRow += negativeTerms.length + 1

            if (!clonedSheet['!cols']) clonedSheet['!cols'] = []
            clonedSheet['!cols'][startCol] = {
              wch: Math.min(Math.max(
                Math.max(...negativeTerms.map(term => term.length), 'Negative'.length) + 2, 15
              ), 60)
            }
          }
        }

        const filteredGroupedData = groupedData.filter((item, index) => index === 0 || item.occurrence >= 5)

        if (filteredGroupedData.length > 0) {
          const keywordTitleRow = currentRow
          XLSX.utils.sheet_add_aoa(clonedSheet, [['Bảng từ khóa >=5']], { origin: { r: keywordTitleRow, c: startCol } })
          currentRow += 2

          const keywordTableStartRow = currentRow

          XLSX.utils.sheet_add_aoa(clonedSheet, [
            ['Từ khóa', 'Occurrence', 'Impressions', 'Clicks', 'CTR', 'Spend(USD)', 'Orders', 'Sales(USD)', 'CPC(USD)', 'ACOS', 'ROAS', 'Conversion rate']
          ], { origin: { r: keywordTableStartRow, c: startCol } })
          currentRow += 1

          XLSX.utils.sheet_add_aoa(clonedSheet, filteredGroupedData.map(item => [
            item.keyword,
            item.occurrence,
            item.impressions,
            item.clicks,
            `${item.ctr.toFixed(2)}%`,
            item.spend.toFixed(2),
            item.orders,
            item.sales.toFixed(2),
            item.cpc.toFixed(2),
            `${item.acos.toFixed(2)}%`,
            item.roas.toFixed(2),
            `${item.conversionRate.toFixed(1)}%`
          ]), { origin: { r: currentRow, c: startCol } })

          applyTableBorder(clonedSheet, keywordTableStartRow, startCol, filteredGroupedData.length + 1, 12)
        }

        appendedSummary = true
      }

      XLSX.utils.book_append_sheet(finalWorkbook, clonedSheet, sheetName.substring(0, 31))
    })

    // Lấy tên file dựa vào tên file gốc
    let fileName = 'tong_hop_phan_tich.xlsx'
    if (file) {
      const originalFileName = file.name
      // Loại bỏ phần mở rộng (.xlsx hoặc .xls)
      const nameWithoutExt = originalFileName.replace(/\.(xlsx|xls)$/i, '')
      fileName = `${nameWithoutExt}_phan_tich.xlsx`
    }

    XLSX.writeFile(finalWorkbook, fileName)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px', color: 'white' }}>
          <Link href="/" style={{
            display: 'inline-block',
            marginBottom: '20px',
            color: 'rgba(255,255,255,0.8)',
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            ← Quay lại trang chính
          </Link>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '10px' }}>
            Phân tích từ khóa
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            Tổng hợp và phân tích các từ khóa đồng nghĩa từ file Excel
          </p>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ position: 'relative' }}>
            <div
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Upload area clicked, fileInputRef:', fileInputRef.current)
                if (fileInputRef.current) {
                  console.log('Triggering file input click')
                  fileInputRef.current.click()
                } else {
                  console.error('File input ref is null')
                }
              }}
              style={{
                border: '2px dashed #667eea',
                borderRadius: '15px',
                padding: '60px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #f5f7ff 0%, #faf5ff 100%)',
                transition: 'all 0.3s ease',
                position: 'relative',
                zIndex: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#764ba2'
                e.currentTarget.style.transform = 'scale(1.01)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 20px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="40" height="40" fill="white" viewBox="0 0 24 24">
                    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>

              {file ? (
                <div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#667eea', marginBottom: '5px' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>
                    Nhấn để chọn file khác
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#333', marginBottom: '5px' }}>
                    Chọn file Excel để phân tích
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>
                    Hỗ trợ định dạng .xlsx, .xls
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                opacity: 0,
                overflow: 'hidden',
                zIndex: -1
              }}
            />
          </div>

          {file && (
            <div style={{ marginTop: '30px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '15px',
                padding: '25px',
                border: '2px solid #10b981'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    background: '#10b981',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="16" height="16" fill="white" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '5px', color: '#333' }}>
                      Chế độ đếm chính xác (Exact Match)
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
                      Đếm từ độc lập + nhóm đồng nghĩa. Ví dụ: &quot;son&quot; trong &quot;my son&quot; = đếm, &quot;son&quot; trong &quot;grandson&quot; = không đếm
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '25px' }}>
                <button
                  onClick={analyzeFile}
                  disabled={processing}
                  style={{
                    padding: '15px 40px',
                    background: processing ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.3s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    if (!processing) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  {processing ? (
                    <>
                      <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span>Phân tích dữ liệu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#fff5f5',
              borderLeft: '4px solid #ef4444',
              borderRadius: '8px',
              color: '#dc2626',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {threeDStats.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f5f7ff 0%, #eef2ff 100%)',
                border: '1px solid #c7d2fe',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4338ca', marginBottom: '10px' }}>
                  Hiệu suất Loại thiệp 3D
                </h3>
                <p style={{ color: '#4338ca', fontSize: '0.9rem', margin: 0 }}>
                  Tổng hợp các chỉ số hiệu suất dựa trên các dòng khớp từng loại thiệp 3D.
                </p>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{
                      background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                      color: 'white'
                    }}>
                      {['Loại thiệp 3D', 'Occurrence', 'Impressions', 'Clicks', 'CTR', 'Spend(USD)', 'Orders', 'Sales(USD)', 'CPC(USD)', 'ACOS', 'ROAS', 'Conversion rate'].map(header => (
                        <th
                          key={header}
                          style={{
                            padding: '14px 12px',
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textTransform: 'uppercase'
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {threeDStats.map((item, index) => (
                      <tr
                        key={item.keyword}
                        style={{
                          background: index % 2 === 0 ? '#f8fafc' : 'white',
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#eef2ff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? '#f8fafc' : 'white'
                        }}
                      >
                        <td style={{ padding: '12px', color: '#312e81', fontWeight: 600 }}>{item.keyword}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.occurrence}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.impressions.toLocaleString()}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.clicks.toLocaleString()}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.ctr.toFixed(2)}%</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>${item.spend.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.orders}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>${item.sales.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>${item.cpc.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.acos.toFixed(2)}%</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.roas.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#312e81' }}>{item.conversionRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#eef2ff', fontWeight: 700 }}>
                      <td style={{ padding: '12px', color: '#312e81' }}>Tổng</td>
                      <td style={{ padding: '12px', color: '#312e81' }}>{threeDStats.reduce((sum, item) => sum + item.occurrence, 0)}</td>
                      <td style={{ padding: '12px', color: '#312e81' }}>{threeDStats.reduce((sum, item) => sum + item.impressions, 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: '#312e81' }}>{threeDStats.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        {(() => {
                          const totalImpressions = threeDStats.reduce((sum, item) => sum + item.impressions, 0)
                          const totalClicks = threeDStats.reduce((sum, item) => sum + item.clicks, 0)
                          return totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
                        })()}%
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        ${threeDStats.reduce((sum, item) => sum + item.spend, 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>{threeDStats.reduce((sum, item) => sum + item.orders, 0)}</td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        ${threeDStats.reduce((sum, item) => sum + item.sales, 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        {(() => {
                          const totalSpend = threeDStats.reduce((sum, item) => sum + item.spend, 0)
                          const totalClicks = threeDStats.reduce((sum, item) => sum + item.clicks, 0)
                          return totalClicks > 0 ? `$${(totalSpend / totalClicks).toFixed(2)}` : '$0.00'
                        })()}
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        {(() => {
                          const totalSales = threeDStats.reduce((sum, item) => sum + item.sales, 0)
                          const totalSpend = threeDStats.reduce((sum, item) => sum + item.spend, 0)
                          return totalSales > 0 ? `${((totalSpend / totalSales) * 100).toFixed(2)}%` : '0.00%'
                        })()}
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        {(() => {
                          const totalSpend = threeDStats.reduce((sum, item) => sum + item.spend, 0)
                          const totalSales = threeDStats.reduce((sum, item) => sum + item.sales, 0)
                          return totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0.00'
                        })()}
                      </td>
                      <td style={{ padding: '12px', color: '#312e81' }}>
                        {(() => {
                          const totalOrders = threeDStats.reduce((sum, item) => sum + item.orders, 0)
                          const totalClicks = threeDStats.reduce((sum, item) => sum + item.clicks, 0)
                          return totalClicks > 0 ? `${((totalOrders / totalClicks) * 100).toFixed(1)}%` : '0.0%'
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {negativeMatches.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
                border: '1px solid #fed7aa',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#c2410c', marginBottom: '10px' }}>
                  Từ khóa Negative (Cần loại trừ)
                </h3>
                <p style={{ color: '#9a3412', fontSize: '0.9rem', margin: 0 }}>
                  Liệt kê các dòng chứa từ khóa không phù hợp như music, gift card, credit card.
                </p>
              </div>

              <div style={{
                borderRadius: '12px',
                border: '1px solid #fcd34d',
                padding: '20px',
                background: 'white'
              }}>
                {negativeMatches.map(item => (
                  <div
                    key={item.group}
                    style={{
                      marginBottom: '20px',
                      paddingBottom: '20px',
                      borderBottom: '1px solid #fee2b7'
                    }}
                  >
                    <h4 style={{ margin: 0, marginBottom: '12px', color: '#c2410c', fontSize: '1.05rem' }}>
                      {item.group}
                    </h4>
                    <ul style={{
                      listStyle: 'disc',
                      paddingLeft: '20px',
                      margin: 0,
                      display: 'grid',
                      gap: '8px'
                    }}>
                      {item.terms.map(term => (
                        <li key={term} style={{ color: '#92400e', fontSize: '0.95rem' }}>
                          {term}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedData.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                padding: '20px',
                background: 'linear-gradient(135deg, #f5f7ff 0%, #faf5ff 100%)',
                borderRadius: '12px'
              }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                  Kết quả phân tích ({groupedData.length} nhóm)
                </h3>
                <button
                  onClick={downloadResults}
                  style={{
                    padding: '12px 25px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  Tải xuống Excel
                </button>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white'
                    }}>
                      {['Từ khóa', 'Occurrence', 'Impressions', 'Clicks', 'CTR', 'Spend(USD)',
                        'Orders', 'Sales(USD)', 'CPC(USD)', 'ACOS', 'ROAS', 'Conversion rate'].map((header) => (
                          <th key={header} style={{
                            padding: '15px 12px',
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textTransform: 'uppercase'
                          }}>
                            {header}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((item, index) => (
                      <tr
                        key={index}
                        style={{
                          background: index === 0 ? '#f9fafb' : 'white',
                          fontWeight: index === 0 ? 'bold' : 'normal',
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (index !== 0) {
                            e.currentTarget.style.background = '#f5f7ff'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (index !== 0) {
                            e.currentTarget.style.background = 'white'
                          }
                        }}
                      >
                        <td style={{ padding: '12px', color: '#333' }}>{item.keyword}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.occurrence}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.impressions.toLocaleString()}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.clicks.toLocaleString()}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.ctr.toFixed(2)}%</td>
                        <td style={{ padding: '12px', color: '#333' }}>${item.spend.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.orders}</td>
                        <td style={{ padding: '12px', color: '#333' }}>${item.sales.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#333' }}>${item.cpc.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.acos.toFixed(2)}%</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.roas.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: '#333' }}>{item.conversionRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ marginTop: '40px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
              borderLeft: '4px solid #3b82f6',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <h4 style={{ fontWeight: 600, marginBottom: '15px', color: '#333', fontSize: '1.1rem' }}>
                Nhóm từ đồng nghĩa
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8', fontSize: '0.9rem', color: '#666' }}>
                <li><strong style={{ color: '#667eea' }}>fathers/father/father&apos;s/dad:</strong> father, fathers, dad, dads, father&apos;s, fathers&apos;</li>
                <li><strong style={{ color: '#667eea' }}>birthday:</strong> birthday, birthdays, birth</li>
                <li><strong style={{ color: '#667eea' }}>dragon/dragons:</strong> dragon, dragons</li>
                <li><strong style={{ color: '#667eea' }}>men/man/male:</strong> men, man, male</li>
                <li><strong style={{ color: '#667eea' }}>women/woman/lady:</strong> women, woman, lady, ladies</li>
                <li><strong style={{ color: '#667eea' }}>son:</strong> son, sons</li>
                <li><strong style={{ color: '#667eea' }}>brother:</strong> brother, brothers</li>
                <li><strong style={{ color: '#667eea' }}>husband:</strong> husband, husbands, from wife</li>
                <li><strong style={{ color: '#667eea' }}>wife:</strong> wife, wives, from husband</li>
                <li><strong style={{ color: '#667eea' }}>mom/mama/mother/mothers:</strong> mom, moms, mama, mamas, mother, mothers, mommy, mommies</li>
                <li><strong style={{ color: '#667eea' }}>flower/floral/bouquet/bloom:</strong> flower, flowers, floral, bouquet, bouquets, bloom, blooms, blossom, blossoms</li>
                <li><strong style={{ color: '#667eea' }}>nasty/naughty/dirty:</strong> nasty, naughty, dirty, dirtier, dirtiest</li>
                <li><strong style={{ color: '#667eea' }}>sister/sis:</strong> sister, sisters, sis, sissy</li>
                <li><strong style={{ color: '#667eea' }}>aunt/auntie:</strong> aunt, aunts, auntie, aunties</li>
                <li><strong style={{ color: '#667eea' }}>uncle/uncles:</strong> uncle, uncles</li>
                <li><strong style={{ color: '#667eea' }}>grandmom/grandmother:</strong> grandmom, grandmoms, grandmother, grandmothers, grandma, grandmas, granny, grannies</li>
                <li><strong style={{ color: '#667eea' }}>daughter/daughters:</strong> daughter, daughters</li>
                <li><strong style={{ color: '#667eea' }}>girl/girls:</strong> girl, girls</li>
                <li><strong style={{ color: '#667eea' }}>card:</strong> card, cards</li>
                <li><strong style={{ color: '#667eea' }}>pop:</strong> pop, popup, pop-up</li>
                <li><strong style={{ color: '#667eea' }}>dungeons:</strong> dungeon, dungeons, dnd</li>
                <li><strong style={{ color: '#667eea' }}>funny/hilarious/humor/humorous/fun/sarcastic/joke:</strong> funny, hilarious, humor, humorous, fun, sarcastic, joke, jokes</li>
                <li><strong style={{ color: '#667eea' }}>kid/kids/child/baby/toddler:</strong> kid, kids, child, children, baby, babies, toddler, toddlers</li>
              </ul>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              borderLeft: '4px solid #10b981',
              padding: '20px',
              borderRadius: '10px'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.6' }}>
                <p>
                  <strong style={{ color: '#10b981' }}>Exact Match:</strong> Vẫn dùng nhóm từ đồng nghĩa, nhưng chỉ đếm từ độc lập. Ví dụ: &quot;son&quot; trong &quot;my son&quot; = đếm vào nhóm &quot;son&quot;, nhưng &quot;son&quot; trong &quot;grandson&quot; = không đếm
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
