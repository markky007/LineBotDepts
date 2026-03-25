import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Client } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';

// 1. ใส่กุญแจของ LINE
// 1. ใส่กุญแจของ LINE (เวอร์ชันแก้ทางเชื่อม)
const lineClient = new Client({
  channelAccessToken: 'q9+ALn2fh5X1zktBVBZG0+IhXUmJoq2N2sLuPUFwQRGFDKkm0sRf0AgXC42PQNd0dsriBwg9QDHB/yC2KAcFV9bSNKnXZyfh97zqktgnP+naEmCegt7C+ybOWNzXxSpAGlz+jKEO/xOJsX3cW9vxYQdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5c05fcaa11b9e95816b82767443fd56e',
});
// 2. ใส่กุญแจของ Supabase
const supabase = createClient(
  'https://dwevscxmhukozoyacedi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZXZzY3htaHVrb3pveWFjZWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDYxODQsImV4cCI6MjA5MDAyMjE4NH0._k-Q8PlKIoF2jjkPJO3pcpKW-MLxoJF-1vdarYb2ATo',
);

@Controller('webhook')
export class AppController {
  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    console.log('ได้รับ Event จาก LINE แล้ว!:', JSON.stringify(body));
    const events = body.events;

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const userId = event.source.userId;
        let replyText = '';

        // ถ้าพิมพ์ขึ้นต้นด้วย + เช่น "+500 ค่าข้าว"
        if (text.startsWith('+')) {
          const parts = text.split(' ');
          const amount = parseInt(parts[0].replace('+', ''));
          const description = parts.slice(1).join(' ') || 'ไม่ได้ระบุรายการ';

          if (!isNaN(amount)) {
            // บันทึกลง Supabase
            const { error } = await supabase
              .from('expenses')
              .insert([{ amount: amount, description: description }]);

            if (error) {
              replyText = '❌ บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ';
            } else {
              // คำนวณยอดรวมปัจจุบัน
              const { data } = await supabase.from('expenses').select('amount');
              const total = (data || []).reduce((sum, item) => sum + item.amount, 0);
              replyText = `✅ บันทึกยอด ${amount} บาท (${description}) เรียบร้อย\n\n💰 ตอนนี้ยอดรวมทั้งหมดคือ: ${total} บาทครับ`;
            }
          }
        }
        // ถ้าพิมพ์คำว่า clear เพื่อลบหนี้
        else if (text.toLowerCase() === 'clear') {
          // ลบข้อมูลทั้งหมดในตาราง
          const { error } = await supabase
            .from('expenses')
            .delete()
            .neq('id', 0); // ทริคในการสั่งลบทั้งหมด

          if (error) {
            replyText = '❌ เคลียร์ยอดไม่สำเร็จ';
          } else {
            replyText =
              '✨ เคลียร์ยอดหนี้ทั้งหมดเรียบร้อยแล้ว! เริ่มนับใหม่ได้เลย';
          }
        }

        // ส่งข้อความตอบกลับไปที่แชท LINE
        if (replyText !== '') {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText,
          });
        }
      }
    }
    return 'OK';
  }
}
