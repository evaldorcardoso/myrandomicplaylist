import { describe, it, expect } from 'vitest'
import { formatDuration, formatReleaseDate, progressPercent } from '@/support/playbackFormat'

// Formatação pura compartilhada pela tela do player e pelo player flutuante
// (#69). É o que garante que os dois exibam exatamente os mesmos rótulos de
// posição/duração e data de lançamento a partir da mesma fonte.
describe('playbackFormat · formatDuration', () => {
  it('formata milissegundos como minutos:segundos com dois dígitos', () => {
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(210000)).toBe('3:30')
    expect(formatDuration(5000)).toBe('0:05')
    expect(formatDuration(0)).toBe('0:00')
  })

  it('trata ausente, negativo e não numérico como zero', () => {
    expect(formatDuration(null)).toBe('0:00')
    expect(formatDuration(undefined)).toBe('0:00')
    expect(formatDuration(-100)).toBe('0:00')
    expect(formatDuration('abc')).toBe('0:00')
  })

  it('trunca a fração de segundo', () => {
    expect(formatDuration(1999)).toBe('0:01')
  })
})

describe('playbackFormat · formatReleaseDate', () => {
  it('formata a data ISO como dia/mês/ano', () => {
    expect(formatReleaseDate('2024-05-01')).toBe('01/05/2024')
  })

  it('aceita precisão parcial', () => {
    expect(formatReleaseDate('2024-05')).toBe('05/2024')
    expect(formatReleaseDate('2024')).toBe('2024')
  })

  it('devolve um traço quando não há data', () => {
    expect(formatReleaseDate(null)).toBe('—')
    expect(formatReleaseDate(undefined)).toBe('—')
    expect(formatReleaseDate('')).toBe('—')
  })
})

describe('playbackFormat · progressPercent', () => {
  it('calcula o percentual da barra a partir de posição e duração', () => {
    expect(progressPercent(42000, 210000)).toBe(20)
    expect(progressPercent(0, 210000)).toBe(0)
    expect(progressPercent(210000, 210000)).toBe(100)
  })

  it('nunca passa de 100% nem desce abaixo de zero', () => {
    expect(progressPercent(300000, 210000)).toBe(100)
    expect(progressPercent(-5, 210000)).toBe(0)
  })

  it('devolve zero sem duração ou com posição inválida', () => {
    expect(progressPercent(1000, 0)).toBe(0)
    expect(progressPercent(1000, null)).toBe(0)
    expect(progressPercent(null, 210000)).toBe(0)
    expect(progressPercent('abc', 210000)).toBe(0)
  })
})
