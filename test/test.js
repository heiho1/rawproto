import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { hexy } from 'hexy'
import { getData } from '../src/index'

const encoded = readFileSync(join(__dirname, 'search_space.pb'))

//console.log('Protobuf:')
//console.log(hexy(encoded))

//console.log(JSON.stringify(getData(encoded), null, 2))
writeFileSync(join(__dirname, 'test.json'), JSON.stringify(getData(encoded), null, 2))
