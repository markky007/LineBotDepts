import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Client } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';

// 1. กุญแจ LINE (เช็คช่องว่างท้ายตัวแปรให้ดีนะครับ)
const lineClient = new Client({
  channelAccessToken: 'q9+ALn2fh5X1zktBVBZG0+IhXUmJoq2N2sLuPUFwQRGFDKkm0sRf0AgXC42PQNd0dsriBwg9QDHB/yC2KAcFV9bSNKnXZyfh97zqktgnP+naEmCegt7C+ybOWNzXxSpAGlz+jKEO/xOJsX3cW9vxYQdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5c05fcaa11b9e95816b82767443fd56e',
});

// 2. กุญแจ Supabase
const supabase = createClient(
  'https://dwevscxmhukozoyacedi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZXZzY3htaHVrb3pveWFjZWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDYxODQsImV4cCI6MjA5MDAyMjE4NH0._k-Q8PlKIoF2jjkPJO3pcpKW-MLxoJF-1vdarYb2ATo'
);

@Controller('webhook')
export class AppController {
  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    const events = body.events;
    if (!events || events.length === 0) return 'OK';

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        let replyText = '';

        console.log(`📩 ได้รับข้อความ: "${text}" จาก User: ${event.source.userId}`);

        // สเต็ป 1: ตรวจสอบว่าเป็นคำสั่งบันทึกยอด (+500 ค่าข้าว)
        if (text.startsWith('+')) {
          const parts = text.split(' ');
          const amount = parseInt(parts[0].replace('+', ''));
          const description = parts.slice(1).join(' ') || 'ไม่ได้ระบุรายการ';

          if (!isNaN(amount)) {
            console.log(`⏳ กำลังบันทึก: ${amount} บาท (${description})`);
            
            try {
              // บันทึกลง Supabase
              const { error: insertError } = await supabase
                .from('expenses')
                .insert([{ amount, description }]);

              if (insertError) {
                console.error('❌ Supabase Insert Error:', insertError.message);
                replyText = `❌ บันทึกไม่สำเร็จ: ${insertError.message}`;
              } else {
                // ดึงยอดรวมมาโชว์
                const { data: allData, error: fetchError } = await supabase
                  .from('expenses')
                  .select('amount');

                if (fetchError) {
                  replyText = `✅ บันทึกแล้ว แต่คำนวณยอดรวมพลาด: ${fetchError.message}`;
                } else {
                  const total = (allData || []).reduce((sum, item) => sum + item.amount, 0);
                  replyText = `✅ บันทึกยอด ${amount} บาท (${description}) เรียบร้อย\n💰 ยอดรวมทั้งหมด: ${total} บาท`;
                }
              }
            } catch (e) {
              console.error('🔥 Critical Error:', e);
              replyText = `🔥 พังที่โค้ด: ${e.message}`;
            }
          } else {
            replyText = '⚠️ รูปแบบผิดครับมาร์ค ต้องเป็น "+ตัวเลข รายละเอียด" เช่น +500 ค่าชาบู';
          }
        }

        // สเต็ป 2: คำสั่งเคลียร์ยอด (clear)
        else if (text.toLowerCase() === 'clear') {
          const { error } = await supabase.from('expenses').delete().neq('id', 0);
          replyText = error ? `❌ เคลียร์ไม่สำเร็จ: ${error.message}` : '✨ เคลียร์ยอดหนี้เรียบร้อยแล้วครับ!';
        }

        // ส่งข้อความกลับไปที่ LINE
        if (replyText) {
          try {
            await lineClient.replyMessage(event.replyToken, { type: 'text', text: replyText });
            console.log('📤 ส่งคำตอบกลับเรียบร้อย');
          } catch (err) {
            console.error('❌ LINE Reply Error:', err.originalError?.response?.data || err.message);
          }
        }
      }
    }
    return 'OK';
  }
}