const app = new Vue({
  el: "#app",
  data: {
    puzzles: null,
    passphrase: "",
    clue: ""
  },
  async created() {
    const localDevKeys = await fetch("/keys.json")
    if (localDevKeys.ok) {
      const keys = await localDevKeys.json()

      const dates = Object.keys(keys).map(key => {
        const [m, d, y] = key.split("/")
        return [key, Date.UTC('20' + y, m - 1, d)]
      })
      dates.sort((a, b) => a[1] - b[1])

      const puzzles = this.puzzles = {
        previous: []
      }

      const now = Date.now()
      for (const [date, utc] of dates) {
        if (utc > now && !puzzles.current) {
          puzzles.next = {
            date, utc
          }
          puzzles.current = puzzles.previous[puzzles.previous.length - 1]
        }
    
        puzzles.previous.push({
          date, utc, key: keys[date]
        })
      }
    } else {
      const puzzles = await fetch("https://christmas-gift-key-distributor.brandosha.repl.co").then(res => res.json())
      // keys.previous.push(keys.current)
      this.puzzles = puzzles
    }

    const { puzzles } = this

    this.getClue(puzzles.current.key)
  },
  methods: {
    async writeClue(clue) {
      this.clue = ""
      for (let i = 0; i < clue.length; i++) {
        const char = clue[i]
        this.clue += char

        const sleepDurations = {
          "\n": 300,
          ".": 200,
          ",": 100
        }

        await new Promise(r => setTimeout(r, sleepDurations[char] || 5))
      }
    },
    async getClue(key) {
      const hash1 = await hash(key)
      const hash2 = hex(await hash(hash1))
  
      const fileName = hash2.slice(0, 12) + ".b64"

      const fileResponse = await fetch("/files/" + fileName)
      if (!fileResponse.ok) {
        alert("Incorrect passphrase")
        return
      }

      const b64 = await fileResponse.text()
      const encrypted = Base64.decode(b64)
  
      const secretKey = await crypto.subtle.importKey('raw', hash1, 'AES-GCM', false, ['encrypt', 'decrypt'])
      const clue = await crypto.subtle.decrypt(aesAlgorithm, secretKey, encrypted)

      this.writeClue(new TextDecoder().decode(clue))
    },
    submitPassphrase() {
      const { puzzles } = this
      const passphrase = this.passphrase.trim().toLowerCase()

      if (!passphrase.length) {
        this.getClue(puzzles.current.key)
      } else {
        this.getClue(puzzles.current.key + "/" + passphrase)
        this.passphrase = ""
      }
    },
    async encryptClue(key, clue) {
      const hash1 = await hash(key)
      const hash2 = hex(await hash(hash1))
  
      const fileName = hash2.slice(0, 12) + ".b64"
      console.log(fileName)

      const data = new TextEncoder().encode(clue)
  
      const secretKey = await crypto.subtle.importKey('raw', hash1, 'AES-GCM', false, ['encrypt', 'decrypt'])
      const encrypted = await crypto.subtle.encrypt(aesAlgorithm, secretKey, data)
      console.log(Base64.encode(encrypted))
    }
  }
})

const aesAlgorithm = {
  name: 'AES-GCM',
  iv: new Uint8Array(Array.from({ length: 12 }, i => 0))
}

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

console.log("Oh, you want to look at the code?\n\nKnock yourself out :)")