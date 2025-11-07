'use client'

import { useState, useRef } from 'react'
import type { ParseError, ParseResult } from 'papaparse'

let papaPromise: Promise<typeof import('papaparse')> | null = null
const loadPapa = () => {
    if (!papaPromise) {
        papaPromise = import('papaparse')
    }
    return papaPromise
}

let xlsxPromise: Promise<typeof import('xlsx')> | null = null
const loadXlsx = () => {
    if (!xlsxPromise) {
        xlsxPromise = import('xlsx')
    }
    return xlsxPromise
}
import Link from 'next/link'

interface FileData {
    name: string
    data: any[][]
}

export default function Home() {
    const [files, setFiles] = useState<File[]>([])
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).filter(file =>
                file.name.endsWith('.csv')
            )
            if (newFiles.length < Array.from(e.target.files).length) {
                setError('Chỉ chấp nhận file CSV!')
                setTimeout(() => setError(null), 3000)
            }
            setFiles(prev => [...prev, ...newFiles])
            setSuccess(null)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
            file.name.endsWith('.csv')
        )

        if (droppedFiles.length < e.dataTransfer.files.length) {
            setError('Chỉ chấp nhận file CSV!')
            setTimeout(() => setError(null), 3000)
        }

        setFiles(prev => [...prev, ...droppedFiles])
        setSuccess(null)
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setSuccess(null)
    }

    const clearAll = () => {
        setFiles([])
        setError(null)
        setSuccess(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const parseCSV = async (file: File): Promise<any[][]> => {
        const Papa = await loadPapa()

        return new Promise((resolve, reject) => {
            ; (Papa as any).parse(file, {
                complete: (results: ParseResult<any>) => {
                    resolve(results.data as any[][])
                },
                error: (error: ParseError) => {
                    reject(error)
                }
            })
        })
    }

    const mergeAndDownload = async () => {
        if (files.length === 0) {
            setError('Vui lòng chọn ít nhất một file CSV!')
            setTimeout(() => setError(null), 3000)
            return
        }

        setProcessing(true)
        setError(null)
        setSuccess(null)

        try {
            // Dynamic import xlsx để tránh lỗi khi load page
            const XLSX = await loadXlsx()

            const parsedFiles: FileData[] = []

            for (const file of files) {
                const data = await parseCSV(file)
                parsedFiles.push({
                    name: file.name,
                    data: data
                })
            }

            const wb = XLSX.utils.book_new()

            // Danh sách các cột cần lấy (theo thứ tự)
            const requiredColumns = [
                'Matched product',
                'Impressions',
                'Clicks',
                'CTR',
                'Spend(USD)',
                'CPC(USD)',
                'Orders',
                'Sales(USD)',
                'ACOS',
                'ROAS',
                'Conversion rate'
            ]

            let allData: any[][] = []
            let headers: any[] = []

            // Helper function để tìm column indices
            const findColumnIndices = (headerRow: any[]): number[] => {
                const indices: number[] = []

                // Chuẩn hóa header row (loại bỏ khoảng trắng thừa, chuyển về lowercase)
                const normalizedHeaders = headerRow.map((h: any) => {
                    return String(h).trim().toLowerCase().replace(/\s+/g, ' ')
                })

                requiredColumns.forEach(col => {
                    const normalizedCol = col.toLowerCase().trim().replace(/\s+/g, ' ')
                    let index = -1

                    // Xử lý đặc biệt cho "Matched product" - cũng nhận "Customer search term"
                    if (col === 'Matched product') {
                        // Tìm "Matched product" hoặc "Customer search term" trước
                        index = normalizedHeaders.findIndex((h: string) => {
                            const hClean = h.replace(/[()]/g, '').replace(/\s+/g, '')
                            return hClean === 'matchedproduct' ||
                                hClean === 'customersearchterm' ||
                                (h.includes('matched') && h.includes('product')) ||
                                (h.includes('customer') && h.includes('search') && h.includes('term'))
                        })
                    } else {
                        // Tìm exact match (sau khi normalize) cho các cột khác
                        index = normalizedHeaders.findIndex((h: string) => {
                            // Loại bỏ dấu ngoặc và khoảng trắng để so sánh
                            const hClean = h.replace(/[()]/g, '').replace(/\s+/g, '')
                            const colClean = normalizedCol.replace(/[()]/g, '').replace(/\s+/g, '')
                            return hClean === colClean || h === normalizedCol
                        })

                        // Nếu không tìm thấy exact match, tìm partial match
                        if (index === -1) {
                            if (col === 'Conversion rate' || col === 'Conversion') {
                                index = normalizedHeaders.findIndex(h => h.includes('conversion'))
                            } else {
                                // Tìm theo từ khóa chính trong tên cột
                                const keywords = normalizedCol.split(/\s+/).filter(k => k.length > 2)
                                index = normalizedHeaders.findIndex((h: string) => {
                                    return keywords.some(keyword => h.includes(keyword))
                                })
                            }
                        }
                    }

                    indices.push(index)
                })

                return indices
            }

            parsedFiles.forEach((fileData, index) => {
                if (fileData.data.length > 0 && fileData.data[0]) {
                    const headerRow = fileData.data[0]

                    // Tìm index của các cột cần thiết cho file này
                    const fileColumnIndices = findColumnIndices(headerRow)

                    // Chỉ thêm header một lần (từ file đầu tiên)
                    if (index === 0) {
                        headers = requiredColumns
                        allData.push(headers)
                    }

                    // Lấy dữ liệu chỉ từ các cột cần thiết
                    const dataRows = fileData.data.slice(1)
                    dataRows.forEach(row => {
                        if (row && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                            const filteredRow = fileColumnIndices.map(colIndex => {
                                if (colIndex === -1) return ''
                                return row[colIndex] !== undefined ? row[colIndex] : ''
                            })
                            allData.push(filteredRow)
                        }
                    })
                }
            })

            const ws = XLSX.utils.aoa_to_sheet(allData)

            const colWidths = allData[0]?.map((_, colIndex) => {
                const maxLength = Math.max(
                    ...allData.map(row =>
                        String(row[colIndex] || '').length
                    )
                )
                return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }
            })
            ws['!cols'] = colWidths

            XLSX.utils.book_append_sheet(wb, ws, 'Combined Data')

            // Xác định tên file dựa vào tên file CSV đầu tiên
            let fileName = 'merged_data.xlsx'
            if (files.length > 0) {
                const firstFileName = files[0].name
                if (firstFileName.startsWith('Sponsored_Brands')) {
                    fileName = 'SB_Combine.xlsx'
                } else if (firstFileName.startsWith('Sponsored_Products')) {
                    fileName = 'SP_Combine.xlsx'
                } else {
                    // Nếu không khớp, giữ tên mặc định với timestamp
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
                    fileName = `merged_data_${timestamp}.xlsx`
                }
            }

            XLSX.writeFile(wb, fileName)

            setSuccess(`Đã tạo file Excel thành công: ${fileName}`)
            setProcessing(false)
        } catch (err) {
            console.error('Error merging files:', err)
            setError('Có lỗi xảy ra khi xử lý file. Vui lòng kiểm tra lại!')
            setProcessing(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        }}>
            <div style={{ width: '100%', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px', color: 'white' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '10px' }}>
                        CSV to Excel Merger
                    </h1>
                    <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '20px' }}>
                        Tổng hợp nhiều file CSV thành một file Excel dễ dàng
                    </p>
                    <Link
                        href="/analyze"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            borderRadius: '10px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            transition: 'all 0.3s ease',
                            border: '1px solid rgba(255,255,255,0.3)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                        }}
                    >
                        <span>Phân tích từ khóa</span>
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>

                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '40px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${isDragging ? '#764ba2' : '#667eea'}`,
                            borderRadius: '15px',
                            padding: '60px 40px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: isDragging
                                ? 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
                                : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                            transition: 'all 0.3s ease',
                            transform: isDragging ? 'scale(1.02)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                            if (!isDragging) {
                                e.currentTarget.style.borderColor = '#764ba2'
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
                                e.currentTarget.style.transform = 'translateY(-2px)'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isDragging) {
                                e.currentTarget.style.borderColor = '#667eea'
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }
                        }}
                    >
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

                        <div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: '#333', marginBottom: '10px' }}>
                                Kéo thả file CSV vào đây hoặc nhấn để chọn
                            </p>
                            <p style={{ fontSize: '0.95rem', color: '#666' }}>
                                Hỗ trợ nhiều file CSV cùng lúc
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            style={{ display: 'none' }}
                            accept=".csv"
                            multiple
                            onChange={handleFileChange}
                        />
                    </div>

                    {files.length > 0 && (
                        <div style={{ marginTop: '30px' }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '15px', color: '#333' }}>
                                Danh sách file ({files.length})
                            </h3>

                            <div style={{ marginBottom: '20px' }}>
                                {files.map((file, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '15px',
                                            background: '#f8f9fa',
                                            borderRadius: '10px',
                                            marginBottom: '10px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#e9ecef'
                                            e.currentTarget.style.transform = 'translateX(5px)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#f8f9fa'
                                            e.currentTarget.style.transform = 'translateX(0)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                background: '#667eea',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 'bold'
                                            }}>
                                                {index + 1}
                                            </div>
                                            <span style={{ fontWeight: 500, color: '#333' }}>{file.name}</span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            style={{
                                                padding: '8px 15px',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#dc2626'
                                                e.currentTarget.style.transform = 'scale(1.05)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#ef4444'
                                                e.currentTarget.style.transform = 'scale(1)'
                                            }}
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '20px',
                                marginBottom: '30px'
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    padding: '20px',
                                    borderRadius: '10px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '5px' }}>
                                        {files.length}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>File CSV</div>
                                </div>
                                <div style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    padding: '20px',
                                    borderRadius: '10px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '5px' }}>
                                        {(files.reduce((acc, file) => acc + file.size, 0) / 1024).toFixed(2)} KB
                                    </div>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Tổng dung lượng</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                <button
                                    onClick={mergeAndDownload}
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
                                        transition: 'all 0.3s ease'
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
                                    {processing ? 'Đang xử lý...' : 'Tải xuống Excel'}
                                </button>
                                <button
                                    onClick={clearAll}
                                    disabled={processing}
                                    style={{
                                        padding: '15px 40px',
                                        background: '#f8f9fa',
                                        color: '#333',
                                        border: '2px solid #dee2e6',
                                        borderRadius: '10px',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        cursor: processing ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!processing) {
                                            e.currentTarget.style.background = '#e9ecef'
                                            e.currentTarget.style.transform = 'translateY(-2px)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#f8f9fa'
                                        e.currentTarget.style.transform = 'translateY(0)'
                                    }}
                                >
                                    Xóa tất cả
                                </button>
                            </div>
                        </div>
                    )}

                    {processing && (
                        <div style={{
                            marginTop: '20px',
                            padding: '40px',
                            textAlign: 'center',
                            color: '#667eea'
                        }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #667eea',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 20px'
                            }}></div>
                            <p style={{ fontWeight: 500 }}>Đang xử lý và tổng hợp dữ liệu...</p>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            marginTop: '20px',
                            padding: '15px',
                            background: '#fff5f5',
                            border: '2px solid #ef4444',
                            borderRadius: '10px',
                            color: '#dc2626',
                            textAlign: 'center',
                            fontWeight: 500
                        }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{
                            marginTop: '20px',
                            padding: '15px',
                            background: '#e8f8f0',
                            border: '2px solid #10b981',
                            borderRadius: '10px',
                            color: '#059669',
                            textAlign: 'center',
                            fontWeight: 500
                        }}>
                            {success}
                        </div>
                    )}

                    <div style={{
                        marginTop: '40px',
                        paddingTop: '30px',
                        borderTop: '2px solid #e9ecef',
                        textAlign: 'center',
                        color: '#666',
                        fontSize: '0.9rem'
                    }}>
                        <p style={{ marginBottom: '10px' }}>
                            <strong>Mẹo:</strong> File Excel sẽ chỉ có một sheet tổng hợp duy nhất từ các file CSV
                        </p>
                        <p>
                            Được tạo bởi Next.js - Dễ dàng deploy lên Vercel
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    )
}
