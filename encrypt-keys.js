const crypto = require('crypto')
const { readFile, writeFile } = require('fs')

const [key, iv] = process.env.K.split(":").map(b64 => Buffer.from(b64, 'base64'))
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

readFile("keys.json", (err, data) => {
  const json = JSON.stringify(JSON.parse(data.toString()))
  const encrypted = Buffer.concat([cipher.update(json), cipher.final(), cipher.getAuthTag()])

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(encrypted.subarray(-16))
  const decrypted = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()])

  if (decrypted.toString() !== json) {
    throw new Error("Error encrypting data")
  }

  const fileName = "keys.b64"
  writeFile(fileName, encrypted.toString('base64'), () => {
    console.log("Encrypted keys written to " + fileName)
  })
})