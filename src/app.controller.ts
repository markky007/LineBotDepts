import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Client } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';

const lineClient = new Client({
  channelAccessToken: 'q9+ALn2fh5X1zktBVBZG0+IhXUmJoq2N2sLuPUFwQRGFDKkm0sRf0AgXC42PQNd0dsriBwg9QDHB/yC2KAcFV9bSNKnXZyfh97zqktgnP+naEmCegt7C+ybOWNzXxSpAGlz+jKEO/xOJsX3cW9vxYQdB04t89/1O/w1cDnyilFU=',
  channelSecret: '5c05fcaa11b9e95816b82767443fd56e',
});

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

        // 1. ฟังก์ชันบันทึกยอด (+500 ค่าข้าว)
        if (text.startsWith('+')) {
          const parts = text.split(' ');
          const amount = parseInt(parts[0].replace('+', ''));
          const description = parts.slice(1).join(' ') || 'ไม่ได้ระบุรายการ';

          if (!isNaN(amount)) {
            try {
              const { error: insertError } = await supabase
                .from('expenses')
                .insert([{ amount, description }]);

              if (!insertError) {
                const { data: allData } = await supabase.from('expenses').select('amount');
                const total = (allData || []).reduce((sum, item) => sum + item.amount, 0);
                
                // จัดหน้าตาข้อความให้น่ารัก
                replyText = `✅ บันทึกสำเร็จ!\n\n📝 รายการ: ${description}\n💸 ยอดเงิน: ${amount.toLocaleString()} บาท\n━━━━━━━━━━\n💰 ยอดรวมค้างชำระ: ${total.toLocaleString()} บาท`;
              } else {
                replyText = `❌ บันทึกไม่สำเร็จ: ${insertError.message}`;
              }
            } catch (e) {
              replyText = `🔥 Error: ${e.message}`;
            }
          }
        }

        // 2. ฟังก์ชัน "สรุป" รายการทั้งหมด
        else if (text === 'สรุป' || text.toLowerCase() === 'list') {
          try {
            const { data, error } = await supabase
              .from('expenses')
              .select('*')
              .order('id', { ascending: true });

            if (error) {
              replyText = `❌ ดึงข้อมูลไม่สำเร็จ: ${error.message}`;
            } else if (data.length === 0) {
              replyText = '📋 ตอนนี้ยังไม่มียอดค้างชำระครับ ✨';
            } else {
              let listStr = '';
              let total = 0;
              
              data.forEach((item, index) => {
                listStr += `${index + 1}. ${item.description}: ${item.amount.toLocaleString()}.-\n`;
                total += item.amount;
              });

              replyText = `📋 รายการค้างชำระทั้งหมด\n\n${listStr}\n━━━━━━━━━━\n💰 รวมทั้งหมด: ${total.toLocaleString()} บาท`;
            }
          } catch (e) {
            replyText = `🔥 Error: ${e.message}`;
          }
        }

        // 3. ฟังก์ชันเคลียร์ยอด (clear)
        else if (text.toLowerCase() === 'clear') {
          const { error } = await supabase.from('expenses').delete().neq('id', 0);
          replyText = error ? `❌ เคลียร์ไม่สำเร็จ: ${error.message}` : '🧹 เคลียร์ยอดหนี้ทั้งหมดเรียบร้อยแล้ว! เริ่มนับใหม่ได้เลย ✨';
        }

        if (replyText) {
          await lineClient.replyMessage(event.replyToken, { type: 'text', text: replyText });
        }
      }
    }
    return 'OK';
  }
}