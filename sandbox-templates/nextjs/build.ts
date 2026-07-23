import { Template, defaultBuildLogger } from 'e2b'
import { template as nextJSTemplate } from './template'
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ! CHECK: if env loads successfully
// console.log('cwd:', process.cwd())
// console.log('E2B_API_KEY:', process.env.E2B_API_KEY)
Template.build(nextJSTemplate , "z0" , {
    cpuCount: 4,
    memoryMB: 4096,
    onBuildLogs: defaultBuildLogger(),
    apiKey:process.env.E2B_API_KEY
})



