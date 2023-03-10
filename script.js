const app = new Vue({
  el: "#app",
  data: {
    puzzles: null,
    passphrase: "",
    clue: {
      message: "",
      solved: false
    },

    timerMs: 0
  },
  async created() {
    const localDevKeys = await fetch("/keys.json")
    if (localDevKeys.ok) {
      const keys = await localDevKeys.json()

      const dates = Object.keys(keys).map(key => {
        const [m, d, y] = key.split("/")
        return [key, Date.UTC('20' + y, m - 1, d, 8)]
      })
      dates.sort((a, b) => a[1] - b[1])

      const puzzles = this.puzzles = {
        previous: [],
        unlocked: []
      }

      const now = Date.now()
      for (const [date, utc] of dates) {
        const puzzle = {
          date, utc, key: keys[date]
        }

        puzzles.unlocked.push(puzzle)

        if (utc < now) {
          puzzles.previous.push(puzzle)
        }

        if (utc > now && !puzzles.current) {
          puzzles.next = {
            date, utc
          }
          puzzles.current = puzzles.previous.pop()
        }
      }
    } else {
      const puzzles = await fetch("https://christmas-gift-key-distributor.brandosha.repl.co").then(res => res.json())
      puzzles.unlocked = puzzles.previous.concat([puzzles.current])
      this.puzzles = puzzles
    }

    const { puzzles } = this

    const { lastPassphrase } = localStorage
    const { key } = puzzles.current

    if (lastPassphrase != null) {
      const fullKey = key + (lastPassphrase ? "/" + lastPassphrase : "")
      if (await this.getClue(fullKey, true)) {
        this.passphrase = lastPassphrase
      } else {
        this.getClue(key)
      }
    } else {
      this.getClue(key)
    }
  },
  methods: {
    async writeClue(clue) {
      this.clue.solved = false
      this.clue.message = ""

      let cancelled = false
      if (this.stopWritingClue) this.stopWritingClue()
      this.stopWritingClue = () => cancelled = true

      for (const match of clue.message.match(/<.*?>|./gs)) {
        if (cancelled) return

        const str = match
        this.clue.message += str

        if (str.length > 1) continue

        const sleepDurations = {
          "\n": 300,
          ".": 200,
          "?": 200,
          "!": 200,
          ",": 100
        }

        await sleep(sleepDurations[str] || 5)
      }

      if (clue.solved) {
        await sleep(1000)
        this.clue.solved = true
        this.updateTimer()
      } else {
        this.clue.solved = false
      }
    },
    async getClue(key, disableWriteAnimation) {
      const hash1 = await hash(key)
      const hash2 = hex(await hash(hash1))
  
      const fileName = hash2.slice(0, 12) + ".b64"

      const fileResponse = await fetch("/files/" + fileName)
      if (!fileResponse.ok) return false

      const b64 = await fileResponse.text()
      const encrypted = Base64.decode(b64)
  
      const secretKey = await crypto.subtle.importKey('raw', hash1, 'AES-GCM', false, ['encrypt', 'decrypt'])

      const aesAlgorithm = {
        name: 'AES-GCM',
        iv: new Uint8Array(Array.from({ length: 12 }, i => 0))
      }
      let clue = await crypto.subtle.decrypt(aesAlgorithm, secretKey, encrypted)
      clue = new TextDecoder().decode(clue)
      clue = JSON.parse(clue)

      if (disableWriteAnimation) {
        clue.solved = !!clue.solved
        this.clue = clue

        if (clue.solved) this.updateTimer()

        return true
      } else {
        return {
          written: this.writeClue(clue)
        }
      }
    },
    async submitPassphrase() {
      const { puzzles } = this
      const passphrase = this.passphrase.trim().toLowerCase()

      let key = puzzles.current.key
      if (passphrase) key += "/" + passphrase

      this.passphrase = ""
      if (await this.getClue(key)) {
        localStorage.setItem('lastPassphrase', passphrase)
      } else {
        alert("Incorrect passphrase")
      }
    },
    updateTimer() {
      if (!this.clue.solved) return
      this.timerMs = this.puzzles.next.utc - Date.now()

      if (this.timerMs < 0) location.reload()

      setTimeout(() => this.updateTimer(), 1000)
    },
    niceDate(puzzle) {
      const [m, _, y] = puzzle.date.split("/")

      const months = { "3": "Mar", "6": "Jun", "9": "Sep", "12": "Dec" }
      return `${months[m]} 20${y}`
    },
    selectPuzzle(i) {
      const puzzle = this.puzzles.unlocked[i]
      this.puzzles.current = puzzle

      this.getClue(puzzle.key)
    }
  },
  computed: {
    timerDurations() {
      this.timerMs;

      const next = dayjs(this.puzzles.next.utc)
      const now = dayjs()

      const months = next.diff(now, "M")

      const durations = [
        months,
        next.subtract(months, "M").diff(now, "d"),
        next.diff(now, "h") % 24,
        next.diff(now, "m") % 60,
        next.diff(now, "s") % 60
      ]

      const names = ["months", "days", "hours", "minutes", "seconds"]

      const result = []
      durations.forEach((count, i) => {
        if (count === 0 && result.length == 0) return

        let name = names[i]
        if (count === 1) name = name.slice(0, -1)

        result.push({
          count, name
        })
      })

      return result
    },
    shouldShowTimer() {
      if (!this.clue.solved) return false

      const { puzzles } = this
      const { unlocked, previous, current } = puzzles

      for (let i = unlocked.length - 1; i > 0; i--) {
        if (unlocked[i] === current) {
          return !!previous[i - 1]
        }
      }

      return true
    }
  }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

const Base64 = {
  encode: arr => btoa(Array.from(new Uint8Array(arr)).map(c => String.fromCharCode(c)).join("")),
  decode: b64 => new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)))
}

function hash(data) {
  if (typeof data === 'string') {
    const textEncoder = new TextEncoder()
    data = textEncoder.encode(data)
  }
  
  return crypto.subtle.digest('SHA-256', data)
}

function hex(buffer) {
  const bytes = new Uint8Array(buffer)

  let output = ""
  for (let i = 0; i < bytes.length; i++) {
    output += bytes[i].toString(16)
  }

  return output
}