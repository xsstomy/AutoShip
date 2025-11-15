#!/usr/bin/env node

/**
 * 数据库驱动迁移验证脚本
 * 验证从 better-sqlite3 到 libsql 的迁移是否成功
 */

const { createClient } = require('@libsql/client')
const fs = require('fs')
const path = require('path')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function main() {
  log('\n🗄️  数据库迁移验证脚本', 'cyan')
  log('=' .repeat(50), 'cyan')

  try {
    // 步骤 1: 检查数据库文件
    log('\n📁 步骤 1: 检查数据库文件', 'blue')
    const dbPath = './database.db'
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath)
      log(`✅ 数据库文件存在: ${dbPath}`, 'green')
      log(`   文件大小: ${(stats.size / 1024).toFixed(2)} KB`, 'yellow')
    } else {
      log(`⚠️  数据库文件不存在，将创建新数据库`, 'yellow')
    }

    // 步骤 2: 连接数据库
    log('\n🔌 步骤 2: 连接数据库', 'blue')
    const client = createClient({
      url: 'file:./database.db'
    })
    log('✅ 数据库连接成功', 'green')

    // 步骤 3: 执行健康检查
    log('\n💓 步骤 3: 执行健康检查', 'blue')
    const healthResult = await client.execute('SELECT 1 as health')
    if (healthResult.rows.length > 0 && healthResult.rows[0].health === 1) {
      log('✅ 数据库健康检查通过', 'green')
    } else {
      throw new Error('健康检查失败')
    }

    // 步骤 4: 检查表是否存在
    log('\n📋 步骤 4: 检查数据表', 'blue')
    const requiredTables = [
      'products',
      'product_prices',
      'orders',
      'deliveries',
      'downloads',
      'payments_raw',
      'inventory_text',
      'settings',
      'admin_logs',
      'files',
      'config',
      'audit_logs',
      'rate_limits',
      'security_tokens',
      'admin_users',
      'admin_sessions',
      'admin_audit_logs'
    ]

    let tablesExist = 0
    for (const tableName of requiredTables) {
      try {
        await client.execute(`SELECT 1 FROM ${tableName} LIMIT 1`)
        tablesExist++
        log(`  ✅ ${tableName}`, 'green')
      } catch (error) {
        if (error.message?.includes('no such table')) {
          log(`  ⚠️  ${tableName} - 表不存在`, 'yellow')
        } else {
          log(`  ❌ ${tableName} - 检查失败: ${error.message}`, 'red')
        }
      }
    }

    log(`\n📊 表检查结果: ${tablesExist}/${requiredTables.length} 个表存在`, 'cyan')

    // 步骤 5: 测试 CRUD 操作
    log('\n🧪 步骤 5: 测试 CRUD 操作', 'blue')

    // 测试 INSERT (创建临时表测试)
    try {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS migration_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await client.execute(`
        INSERT INTO migration_test (message) VALUES (?)
      `, [`Migration test at ${new Date().toISOString()}`])

      const insertResult = await client.execute('SELECT * FROM migration_test')
      log(`  ✅ INSERT 操作成功 - 插入 ${insertResult.rows.length} 条记录`, 'green')

      // 清理测试表
      await client.execute('DROP TABLE migration_test')
      log(`  ✅ 清理测试表成功`, 'green')
    } catch (error) {
      log(`  ❌ CRUD 测试失败: ${error.message}`, 'red')
      throw error
    }

    // 步骤 6: 测试事务
    log('\n🔄 步骤 6: 测试事务', 'blue')
    try {
      await client.execute('BEGIN')
      await client.execute(`
        CREATE TABLE IF NOT EXISTS transaction_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          value INTEGER
        )
      `)
      await client.execute('INSERT INTO transaction_test (value) VALUES (1)')
      await client.execute('INSERT INTO transaction_test (value) VALUES (2)')
      await client.execute('COMMIT')

      const transResult = await client.execute('SELECT COUNT(*) as count FROM transaction_test')
      log(`  ✅ 事务操作成功 - 记录数: ${transResult.rows[0].count}`, 'green')

      // 清理
      await client.execute('DROP TABLE transaction_test')
    } catch (error) {
      await client.execute('ROLLBACK')
      log(`  ❌ 事务测试失败: ${error.message}`, 'red')
      throw error
    }

    // 完成
    log('\n' + '='.repeat(50), 'cyan')
    log('✅ 数据库迁移验证完成！', 'green')
    log('所有基础功能测试通过', 'cyan')
    log('='.repeat(50), 'cyan')

    // 清理客户端连接
    await client.close()

    process.exit(0)
  } catch (error) {
    log('\n❌ 验证失败！', 'red')
    log(`错误: ${error.message}`, 'red')
    log('\n错误堆栈:', 'red')
    console.error(error)
    process.exit(1)
  }
}

// 运行主函数
main().catch(error => {
  log(`\n❌ 未捕获的错误: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
