#!/usr/bin/env node
/**
 * 支付集成验证脚本
 *
 * 用于快速验证支付网关集成的核心功能
 */

const http = require('http')

// 配置
const BASE_URL = 'http://localhost:3000'
const TIMEOUT = 5000

/**
 * 发送HTTP请求
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          }
          resolve(response)
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(TIMEOUT, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

/**
 * 测试API端点
 */
async function testEndpoint(name, options, data = null, expectedStatus = 200) {
  console.log(`\n测试: ${name}`)
  console.log(`  请求: ${options.method} ${options.path}`)

  try {
    const response = await makeRequest(options, data)

    if (response.statusCode === expectedStatus) {
      console.log(`  ✅ 状态码: ${response.statusCode}`)
      if (response.body.success !== undefined) {
        console.log(`  ✅ 响应: success=${response.body.success}`)
      }
      return true
    } else {
      console.log(`  ❌ 状态码: ${response.statusCode} (期望: ${expectedStatus})`)
      if (response.body.error) {
        console.log(`  ❌ 错误: ${response.body.error.message || response.body.error}`)
      }
      return false
    }
  } catch (error) {
    console.log(`  ❌ 请求失败: ${error.message}`)
    return false
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('='.repeat(60))
  console.log('支付网关集成验证')
  console.log('='.repeat(60))

  let passed = 0
  let failed = 0

  // 测试1: 基础健康检查
  const test1 = await testEndpoint(
    '基础健康检查',
    {
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    },
    null,
    200
  )
  test1 ? passed++ : failed++

  // 测试2: API健康检查
  const test2 = await testEndpoint(
    'API健康检查',
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    },
    null,
    200
  )
  test2 ? passed++ : failed++

  // 测试3: Webhook健康检查
  const test3 = await testEndpoint(
    'Webhook健康检查',
    {
      hostname: 'localhost',
      port: 3000,
      path: '/webhooks/health',
      method: 'GET'
    },
    null,
    200
  )
  test3 ? passed++ : failed++

  // 测试4: 获取支付网关列表
  const test4 = await testEndpoint(
    '获取支付网关列表',
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/payments/gateways',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    null,
    200
  )
  test4 ? passed++ : failed++

  // 测试5: 验证商品
  const test5 = await testEndpoint(
    '验证商品',
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/checkout/products/1/validate',
      method: 'GET'
    },
    null,
    200
  )
  test5 ? passed++ : failed++

  // 打印结果
  console.log('\n' + '='.repeat(60))
  console.log('测试结果')
  console.log('='.repeat(60))
  console.log(`总计: ${passed + failed}`)
  console.log(`通过: ${passed} ✅`)
  console.log(`失败: ${failed} ❌`)
  console.log('='.repeat(60))

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！支付网关集成基本功能正常。')
    console.log('\n下一步:')
    console.log('1. 配置支付网关密钥')
    console.log('2. 实现RSA2签名算法')
    console.log('3. 测试真实支付流程')
    return 0
  } else {
    console.log('\n⚠️  有测试失败，请检查错误信息。')
    return 1
  }
}

// 运行测试
runTests()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((error) => {
    console.error('测试执行失败:', error)
    process.exit(1)
  })
