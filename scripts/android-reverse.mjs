import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const targetIndex = args.indexOf('--target')
const target = targetIndex === -1
  ? args.find(arg => arg.startsWith('--target='))?.slice('--target='.length)
  : args[targetIndex + 1]

const devices = execFileSync('adb', ['devices'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .map(line => /^(\S+)\s+device$/.exec(line.trim())?.[1])
  .filter(Boolean)
const selected = target ? devices.filter(device => device === target) : devices

if (selected.length === 0) {
  throw new Error('No matching Android device connected. Connect and authorize the phone or start the emulator, then retry.')
}

// native-run removes its --forward mappings as soon as deployment finishes.
// Own the mapping here so Nuxt modules and HMR stay reachable afterwards.
for (const device of selected) {
  execFileSync('adb', ['-s', device, 'reverse', 'tcp:5173', 'tcp:5173'], { stdio: 'inherit' })
  console.log(`Android ${device}: localhost:5173 -> development server:5173`)
}
