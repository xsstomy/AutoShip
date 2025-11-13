// 测试支付网关配置
require('dotenv').config();
const { paymentGatewayManager } = require('./dist/services/payment-gateway-service.js');

async function testPaymentGateway() {
  console.log('=== 测试支付网关配置 ===\n');

  try {
    // 初始化支付网关管理器
    console.log('1. 初始化支付网关管理器...');
    await paymentGatewayManager.initialize();
    console.log('✅ 支付网关管理器初始化完成\n');

    // 获取启用的网关
    console.log('2. 获取启用的支付网关...');
    const enabledGateways = await paymentGatewayManager.getEnabledGateways();
    console.log(`✅ 找到 ${enabledGateways.length} 个启用的网关:`);
    enabledGateways.forEach(gateway => {
      console.log(`   - ${gateway.name}`);
    });
    console.log();

    // 测试 Alipay 网关配置
    if (enabledGateways.find(g => g.name === 'alipay')) {
      console.log('3. 测试支付宝网关配置...');
      const alipayGateway = paymentGatewayManager.getGateway('alipay');

      try {
        const isValid = await alipayGateway.validateConfig();
        console.log(`✅ 支付宝网关配置验证: ${isValid ? '通过' : '失败'}`);

        // 尝试创建测试支付
        console.log('\n4. 测试创建支付链接...');
        const paymentParams = {
          orderId: 'TEST_ORDER_' + Date.now(),
          amount: 0.01,
          currency: 'CNY',
          productName: '测试商品',
          customerEmail: 'test@example.com',
          returnUrl: process.env.FRONTEND_URL + '/payment/return',
          notifyUrl: process.env.BASE_URL + '/webhooks/alipay'
        };

        const paymentLink = await alipayGateway.createPayment(paymentParams);
        console.log('✅ 支付链接创建成功:');
        console.log(`   - 网关订单ID: ${paymentLink.gatewayOrderId}`);
        console.log(`   - 支付URL: ${paymentLink.paymentUrl}`);
        console.log(`   - 过期时间: ${paymentLink.expiresAt}`);

        // 验证支付URL
        console.log('\n5. 验证支付URL格式...');
        if (paymentLink.paymentUrl.includes('ALIPAY_') &&
            paymentLink.paymentUrl.includes('sandbox.alipay.com')) {
          console.log('✅ 支付URL格式正确 (沙盒环境)');
        } else {
          console.log('⚠️ 支付URL可能不是沙盒环境');
        }

      } catch (error) {
        console.error('❌ 支付宝网关测试失败:', error.message);
        if (error.stack) {
          console.error('堆栈信息:', error.stack);
        }
      }
    }

    // 测试 Creem 网关配置
    if (enabledGateways.find(g => g.name === 'creem')) {
      console.log('\n6. 测试 Creem 网关配置...');
      const creemGateway = paymentGatewayManager.getGateway('creem');

      try {
        const isValid = await creemGateway.validateConfig();
        console.log(`✅ Creem网关配置验证: ${isValid ? '通过' : '失败'}`);
      } catch (error) {
        console.error('❌ Creem网关测试失败:', error.message);
      }
    }

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.stack) {
      console.error('堆栈信息:', error.stack);
    }
    process.exit(1);
  }
}

testPaymentGateway();
