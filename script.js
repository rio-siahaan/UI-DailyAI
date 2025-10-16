const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const imageInput = document.getElementById("image-input");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  const image = imageInput.files[0];

  if (!text && !image) return;

  appendMessage(text, "user", image);
  input.value = "";
  imageInput.value = "";

  const loadingMsg = appendMessage("...", "bot", null, true);

  try {
    const formData = new FormData();
    formData.append("message", text);
    if (image) formData.append("image", image);

    // const response = await fetch("http://127.0.0.1:5001/chat", {
    //   method: "POST",
    //   body: formData,
    // });
    const response = await fetch("https://bagustenan-dailyai.hf.space/chat", {
      method: "POST",
      body: formData,
    });

    if (!response.ok || !response.body)
      throw new Error("Server tidak merespon streaming");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    chatBox.removeChild(loadingMsg);

    const botContainer = appendMessage("", "bot");
    const msgBubble = botContainer.querySelector(".message");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const chunk of parts) {
        if (!chunk.trim()) continue;
        if (chunk.includes("[DONE]")) return;

        const match = chunk.match(/^data:\s*(.*)$/);
        if (!match) continue;

        let payload = match[1];
        console.log("📩 Streaming payload:", payload);

        // 🔹 Bersihkan string JSON yang dibungkus triple backticks
        if (payload.startsWith("```json")) {
          payload = payload.replace(/```json|```/g, "").trim();
        }

        try {
          const parsed = JSON.parse(payload);

          if (parsed.done || parsed.raw_output) continue;

          // Setelah const parsed = JSON.parse(payload);
          if (parsed.done || parsed.raw_output) continue;

          // 🔹 Deteksi otomatis apakah payload berisi array langsung atau di dalam properti
          let arrayData = null;
          if (Array.isArray(parsed)) arrayData = parsed;
          else if (Array.isArray(parsed.json)) arrayData = parsed.json;
          else if (Array.isArray(parsed.data)) arrayData = parsed.data;

          if (arrayData) {
            msgBubble.innerHTML = renderDailyJSON(arrayData);
          } else if (parsed.text) {
            msgBubble.textContent += parsed.text;
          } else if (parsed.error) {
            msgBubble.textContent = "⚠️ " + parsed.error;
          } else {
            msgBubble.textContent += JSON.stringify(parsed, null, 2) + "\n";
          }
        } catch (err) {
          // 🔹 Coba parse manual bila ternyata JSON mentah tanpa pembungkus
          try {
            const fallback = JSON.parse(payload);
            msgBubble.innerHTML = renderDailyJSON(fallback);
          } catch {
            msgBubble.textContent += payload;
          }
        }

        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }
  } catch (err) {
    console.error("❌ Streaming Error:", err);
    chatBox.removeChild(loadingMsg);
    appendMessage("⚠️ Gagal memuat respons streaming.", "bot");
  }
});

function appendMessage(text, sender, imageFile = null, isTemp = false) {
  const msgContainer = document.createElement("div");
  msgContainer.className = sender === "user" ? "user-message" : "bot-message";

  const msgBubble = document.createElement("div");
  msgBubble.className = "message";
  msgBubble.textContent = text;
  msgContainer.appendChild(msgBubble);

  if (imageFile) {
    const imgPreview = document.createElement("img");
    imgPreview.className = "chat-image";
    imgPreview.src = URL.createObjectURL(imageFile);
    msgContainer.appendChild(imgPreview);
  }

  chatBox.appendChild(msgContainer);
  chatBox.scrollTop = chatBox.scrollHeight;

  return msgContainer;
}

function renderDailyJSON(dataArray) {
  // if (!Array.isArray(dataArray)) return "⚠️ Format data tidak dikenali.";
  if (!Array.isArray(dataArray)) {
    if (typeof dataArray === "object" && dataArray !== null) {
      dataArray = [dataArray]; // ubah jadi array berisi satu objek
    } else {
      return "⚠️ Format data tidak dikenali.";
    }
  }

  return dataArray
    .map((item, index) => {
      const cardId = `habit-${item.id || index + 1}`;
      const saranText = Array.isArray(item.saran_habit)
        ? item.saran_habit.join(", ")
        : item.saran_habit || "-";

      return `
        <div class="activity-card" id=${cardId}>
          <p><strong>${index + 1}️⃣</strong></p>
          <p><strong>📝 Deskripsi:</strong> ${item.deskripsi_kegiatan}</p>
          <p><strong>📊 Klasifikasi:</strong> 
            <span class="${
              item.klasifikasi_habit === "habit baik"
                ? "habit-good"
                : "habit-bad"
            }">${item.klasifikasi_habit}</span>
          </p>
          <p><strong>💡 Alasan:</strong> ${item.alasan_klasifikasi}</p>
          <p><strong>✅ Saran:</strong> ${saranText}</p>

          <!-- Tombol simpan -->
          <div class="save-btn-container">
            <button class="save-btn" onclick="handleSaveHabit('${cardId}', '${encodeURIComponent(
        JSON.stringify(item)
      )}')">💾 Disimpan</button>
          </div>
          
        </div>
      `;
    })
    .join("<hr class='divider'>"); // garis pemisah antar blok
}

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

async function handleSaveHabit(cardId, habitDataEncoded) {
  const card = document.getElementById(cardId);
  const button = card.querySelector(".save-btn");

  button.textContent = "⏳ Menyimpan...";
  button.disabled = true;

  const habitData = JSON.parse(decodeURIComponent(habitDataEncoded));

  // Tambahkan metadata tanggal hari ini
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0];
  const payload = {
    ...habitData,
    tanggal: formattedDate,
  };

  try {
    // const response = await fetch("http://127.0.0.1:5001/save-habit", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });
    const response = await fetch("https://bagustenan-dailyai.hf.space/save-habit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Gagal menyimpan ke Qdrant");

    const result = await response.json();
    console.log("✅ Habit tersimpan ke Qdrant:", result);

    button.textContent = "✅ Tersimpan";
    button.classList.add("saved");
  } catch (err) {
    console.error("❌ Error simpan habit:", err);
    button.textContent = "⚠️ Gagal Simpan";
    button.disabled = false;
  }
}