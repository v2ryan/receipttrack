// app.js

// 1. 引入 Firebase 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, writeBatch, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// 2. Firebase 設定 (來自您的來源資料 [1][2])
const firebaseConfig = {
    apiKey: "AIzaSyBgy2_tglOfkF_CFpCl2xaNFu19Jx5iDBs",
    authDomain: "my-expense-tracker-474d4.firebaseapp.com",
    projectId: "my-expense-tracker-474d4",
    storageBucket: "my-expense-tracker-474d4.firebasestorage.app",
    messagingSenderId: "702959051936",
    appId: "1:702959051936:web:1d5b78d047fde4eca4d5c5"
};

// 初始化 App 與 Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 全域變數儲存圖表實例
let myChart = null;

// ==========================================
// A. 讀取數據與監聽 (Read & Listen)
// ==========================================

// 監聽 transactions 集合，按時間倒序排列
const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50));

onSnapshot(q, (snapshot) => {
    let transactions = [];
    let totalAmount = 0;
    
    // 用於圖表分類統計
    let categoryStats = {}; 

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        transactions.push({ id: doc.id, ...data });

        // 計算總額 (假設只有支出 expense)
        totalAmount += Number(data.amount);

        // 統計分類
        const cat = data.category || "Other";
        if (categoryStats[cat]) {
            categoryStats[cat] += Number(data.amount);
        } else {
            categoryStats[cat] = Number(data.amount);
        }
    });

    // 1. 更新 UI 數字
    document.getElementById('totalBalance').innerText = `$${totalAmount.toLocaleString()}`;
    document.getElementById('totalExpense').innerText = `$${totalAmount.toLocaleString()}`;

    // 2. 更新列表
    renderList(transactions);

    // 3. 更新圖表
    drawChart(categoryStats);
});

// ==========================================
// B. UI 渲染邏輯 (Render UI)
// ==========================================

function renderList(list) {
    const container = document.getElementById('transactionList');
    container.innerHTML = ''; // 清空

    if (list.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">尚無交易紀錄</p>';
        return;
    }

    list.forEach(item => {
        // 根據分類選擇簡單的 icon 背景色 (模仿截圖中的不同色塊)
        let iconBg = 'bg-gray-100 text-gray-500';
        let icon = '🛒';
        
        // 簡單的分類判斷
        const cat = item.category.toLowerCase();
        if (cat.includes('food') || cat.includes('restaurant')) { iconBg = 'bg-orange-100 text-orange-500'; icon = '🍔'; }
        else if (cat.includes('transport')) { iconBg = 'bg-blue-100 text-blue-500'; icon = '🚕'; }
        else if (cat.includes('cloth')) { iconBg = 'bg-purple-100 text-purple-500'; icon = '👔'; }
        else if (cat.includes('medicine')) { iconBg = 'bg-red-100 text-red-500'; icon = '💊'; }

        const html = `
        <div class="transaction-item flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center text-xl">
                    ${icon}
                </div>
                <div>
                    <h4 class="font-bold text-gray-800">${item.item || item.category}</h4>
                    <p class="text-xs text-gray-400">${item.date}</p>
                </div>
            </div>
            <div class="font-bold text-gray-800">
                -$${Number(item.amount).toLocaleString()}
            </div>
        </div>
        `;
        container.innerHTML += html;
    });
}

function drawChart(stats) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const labels = Object.keys(stats);
    const data = Object.values(stats);

    // 配合截圖的紫色系調色盤
    const purplePalette = [
        '#8B5CF6', // Violet 500
        '#D946EF', // Fuchsia 500
        '#6366F1', // Indigo 500
        '#A855F7', // Purple 500
        '#EC4899', // Pink 500
        '#C084FC'  // Purple 300
    ];

    if (myChart) {
        myChart.destroy(); // 銷毀舊圖表以重繪
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: purplePalette,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', // 甜甜圈中間的空心大小，符合截圖風格
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, font: { family: 'Poppins' } }
                }
            }
        }
    });
}

// ==========================================
// C. 資料寫入邏輯 (Admin Upload)
// ==========================================

// 將函式掛載到 window 以便 HTML onclick 呼叫
window.uploadData = async function() {
    const jsonStr = document.getElementById('jsonInput').value;
    if (!jsonStr) return alert("請輸入 JSON 數據");

    try {
        const data = JSON.parse(jsonStr);
        if (!Array.isArray(data)) throw new Error("數據必須是 Array 格式");

        const batch = writeBatch(db); // 使用 Batch 一次寫入多筆
        
        data.forEach(item => {
            const docRef = doc(collection(db, "transactions"));
            batch.set(docRef, {
                ...item,
                timestamp: serverTimestamp() // 加入伺服器時間戳記以便排序
            });
        });

        await batch.commit();
        
        alert(`成功寫入 ${data.length} 筆資料！`);
        document.getElementById('jsonInput').value = ''; // 清空輸入框
        document.getElementById('adminPanel').classList.add('hidden'); // 關閉視窗

    } catch (e) {
        console.error(e);
        alert("格式錯誤或寫入失敗：" + e.message);
    }
};