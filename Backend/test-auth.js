const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

// 模拟认证流程
async function testAuth() {
  console.log('=== 认证流程测试 ===\n');

  try {
    // 1. 连接数据库
    console.log('1. 连接数据库...');
    const db = new Database('./database.db');
    console.log('✅ 数据库连接成功\n');

    // 2. 查询管理员用户
    console.log('2. 查询管理员用户...');
    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');

    if (!admin) {
      console.log('❌ 未找到管理员用户');
      return;
    }
    console.log('✅ 找到管理员用户:', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active
    });
    console.log('   密码哈希:', admin.password_hash.substring(0, 20) + '...\n');

    // 3. 验证密码
    console.log('3. 验证密码...');
    const password = 'admin123';
    const isValid = bcrypt.compareSync(password, admin.password_hash);

    if (isValid) {
      console.log('✅ 密码验证成功');
    } else {
      console.log('❌ 密码验证失败');
      console.log('   尝试其他密码...');
      const altPassword = 'password';
      const isAltValid = bcrypt.compareSync(altPassword, admin.password_hash);
      console.log('   密码 "password" 验证结果:', isAltValid);
    }

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testAuth();
