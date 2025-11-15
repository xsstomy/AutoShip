// 测试支付网关配置
import 'dotenv/config';
import { paymentGatewayManager } from './src/services/payment-gateway-service';
import { CONFIG } from './src/config/api';

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
    const alipayGateway = enabledGateways.find(g => g.name === 'alipay');
    if (alipayGateway) {
      console.log('3. 测试支付宝网关配置...');

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
          returnUrl: `${CONFIG.API.FRONTEND_URL}/payment/return`,
          notifyUrl: CONFIG.PAYMENT.ALIPAY.WEBHOOK_URL
        };

        const paymentLink = await alipayGateway.createPayment(paymentParams);
        console.log('✅ 支付链接创建成功:');
        console.log(`   - 网关订单ID: ${paymentLink.gatewayOrderId}`);
        console.log(`   - 支付URL: ${paymentLink.paymentUrl}`);
        console.log(`   - 过期时间: ${paymentLink.expiresAt}`);

        // 验证支付URL
        console.log('\n5. 验证支付URL格式...');
        if (paymentLink.paymentUrl.includes('ALIPAY_') &&
            (paymentLink.paymentUrl.includes('sandbox.alipay.com') || paymentLink.paymentUrl.includes('mock'))) {
          console.log('✅ 支付URL格式正确 (沙盒/模拟环境)');
        } else {
          console.log('⚠️ 支付URL格式可能需要检查');
        }

      } catch (error) {
        console.error('❌ 支付宝网关测试失败:', error.message);
        if (error instanceof Error && error.stack) {
          console.error('堆栈信息:', error.stack);
        }
      }
    }

    // 测试 Creem 网关配置
    const creemGateway = enabledGateways.find(g => g.name === 'creem');
    if (creemGateway) {
      console.log('\n6. 测试 Creem 网关配置...');
      try {
        const isValid = await creemGateway.validateConfig();
        console.log(`✅ Creem网关配置验证: ${isValid ? '通过' : '失败'}`);

        console.log('\n7. 测试创建支付链接...');
        const paymentParams = {
          orderId: 'TEST_ORDER_' + Date.now(),
          amount: 0.01,
          currency: 'USD',
          productName: 'Test Product',
          customerEmail: 'test@example.com',
          returnUrl: `${CONFIG.API.FRONTEND_URL}/payment/return`,
          notifyUrl: CONFIG.PAYMENT.CREEM.WEBHOOK_URL
        };

        const paymentLink = await creemGateway.createPayment(paymentParams);
        console.log('✅ Creem支付链接创建成功:');
        console.log(`   - 网关订单ID: ${paymentLink.gatewayOrderId}`);
        console.log(`   - 支付URL: ${paymentLink.paymentUrl}`);

      } catch (error) {
        console.error('❌ Creem网关测试失败:', error.message);
        if (error instanceof Error && error.stack) {
          console.error('堆栈信息:', error.stack);
        }
      }
    }

    console.log('\n=== 测试完成 ===\n');

    // 输出环境配置信息
    console.log('=== 环境配置信息 ===');
    console.log('支付宝配置:');
    console.log(`  - 启用: ${process.env.PAYMENT_ALIPAY_ENABLED}`);
    console.log(`  - App ID: ${process.env.PAYMENT_ALIPAY_APP_ID ? process.env.PAYMENT_ALIPAY_APP_ID.substring(0, 8) + '...' : 'N/A'}`);
    console.log(`  - Gateway URL: ${process.env.PAYMENT_ALIPAY_GATEWAY_URL}`);
    console.log('Creem配置:');
    console.log(`  - 启用: ${process.env.PAYMENT_CREEM_ENABLED}`);
    console.log(`  - Base URL: ${process.env.PAYMENT_CREEM_BASE_URL}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error instanceof Error && error.stack) {
      console.error('堆栈信息:', error.stack);
    }
    process.exit(1);
  }
}

testPaymentGateway();
