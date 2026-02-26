import {
  formatDuration,
  timeExecution,
} from '../../../src/service/timeUtils.js'

describe('timeUtils', () => {
  describe('timeExecution', () => {
    describe('Given an async function that resolves', () => {
      describe('When timing its execution', () => {
        it('Then it returns the function result and a positive duration', async () => {
          // Arrange
          const expected = 'test-result'
          const fn = async () => expected

          // Act
          const sut = await timeExecution(fn)

          // Assert
          expect(sut.result).toBe(expected)
          expect(sut.durationMs).toBeGreaterThanOrEqual(0)
        })
      })
    })

    describe('Given an async function that rejects', () => {
      describe('When timing its execution', () => {
        it('Then it propagates the error', async () => {
          // Arrange
          const error = new Error('test-error')
          const fn = async () => {
            throw error
          }

          // Act & Assert
          await expect(timeExecution(fn)).rejects.toThrow('test-error')
        })
      })
    })

    describe('Given an async function with measurable delay', () => {
      describe('When timing its execution', () => {
        it('Then the duration reflects the elapsed time', async () => {
          // Arrange
          const delayMs = 50
          const fn = async () => {
            await new Promise(resolve => setTimeout(resolve, delayMs))
            return 'delayed'
          }

          // Act
          const sut = await timeExecution(fn)

          // Assert
          expect(sut.result).toBe('delayed')
          expect(sut.durationMs).toBeGreaterThanOrEqual(delayMs - 10)
        })
      })
    })
  })

  describe('formatDuration', () => {
    describe('Given milliseconds less than 60 seconds', () => {
      describe('When formatting duration', () => {
        it('Then it returns seconds only for 0ms', () => {
          // Act
          const sut = formatDuration(0)

          // Assert
          expect(sut).toBe('~0s')
        })

        it('Then it returns seconds only for sub-second values', () => {
          // Act
          const sut = formatDuration(500)

          // Assert
          expect(sut).toBe('~0s')
        })

        it('Then it returns seconds only for exact seconds', () => {
          // Act
          const sut = formatDuration(45_000)

          // Assert
          expect(sut).toBe('~45s')
        })

        it('Then it truncates fractional seconds', () => {
          // Act
          const sut = formatDuration(59_999)

          // Assert
          expect(sut).toBe('~59s')
        })
      })
    })

    describe('Given milliseconds in the minutes range', () => {
      describe('When formatting duration', () => {
        it('Then it returns minutes and seconds for exactly 60s', () => {
          // Act
          const sut = formatDuration(60_000)

          // Assert
          expect(sut).toBe('~1m 0s')
        })

        it('Then it returns minutes and seconds', () => {
          // Act
          const sut = formatDuration(750_000)

          // Assert
          expect(sut).toBe('~12m 30s')
        })

        it('Then it returns minutes and seconds at upper boundary', () => {
          // Act
          const sut = formatDuration(3_599_999)

          // Assert
          expect(sut).toBe('~59m 59s')
        })
      })
    })

    describe('Given milliseconds in the hours range', () => {
      describe('When formatting duration', () => {
        it('Then it returns hours, minutes, and seconds for exactly 1 hour', () => {
          // Act
          const sut = formatDuration(3_600_000)

          // Assert
          expect(sut).toBe('~1h 0m 0s')
        })

        it('Then it returns hours, minutes, and seconds', () => {
          // Act
          const sut = formatDuration(3_661_000)

          // Assert
          expect(sut).toBe('~1h 1m 1s')
        })

        it('Then it returns multi-hour durations', () => {
          // Act
          const sut = formatDuration(7_265_000)

          // Assert
          expect(sut).toBe('~2h 1m 5s')
        })
      })
    })
  })
})
