import "./style.css";
import { auth, db, configIsPlaceholder } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";

const $ = (id) => document.getElementById(id);
const state = { user: null, projects: [], certificates: [], privateDocs: [] };
const toast = (message) => { $("toast").textContent = message; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 3200); };
const message = (id, text, error = false) => { const el = $(id); el.textContent = text; el.classList.toggle("error", error); };
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const safeURL = (value = "") => { try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } };
const openModal = (id) => { $(id).classList.add("open"); $(id).setAttribute("aria-hidden", "false"); };
const closeModal = (id) => { $(id).classList.remove("open"); $(id).setAttribute("aria-hidden", "true"); };
$("year").textContent = new Date().getFullYear();

if (configIsPlaceholder) {
  toast("Isi konfigurasi Firebase di src/firebase.js terlebih dahulu.");
}

$("open-login").addEventListener("click", () => {
  if (state.user) openModal("admin-panel"); else openModal("login-modal");
});
document.querySelectorAll("[data-close-login]").forEach(el => el.addEventListener("click", () => closeModal("login-modal")));
document.querySelectorAll("[data-close-admin]").forEach(el => el.addEventListener("click", () => closeModal("admin-panel")));
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal("login-modal"); closeModal("admin-panel"); } });

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  message("login-message", "Sedang masuk...");
  try {
    await signInWithEmailAndPassword(auth, $("admin-email").value.trim(), $("admin-password").value);
    message("login-message", "");
    closeModal("login-modal");
    openModal("admin-panel");
  } catch (err) {
    message("login-message", "Login gagal. Periksa email/password dan pastikan akun dibuat di Firebase Authentication.", true);
  }
});
$("logout-button").addEventListener("click", async () => {
  await signOut(auth);
  closeModal("admin-panel");
  toast("Kamu sudah logout.");
});

document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".admin-tab").forEach(panel => panel.hidden = panel.id !== `tab-${btn.dataset.tab}`);
}));

async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, "site", "profile"));
    if (!snap.exists()) return;
    const p = snap.data();
    $("hero-name").textContent = p.name || "Nama Kamu";
    $("portrait-initial").textContent = (p.name || "P").trim().charAt(0).toUpperCase();
    $("hero-summary").textContent = p.summary || "Saya sedang membangun pengalaman dan mengembangkan keterampilan.";
    $("about-text").textContent = p.about || p.summary || "Tambahkan ringkasan profil melalui panel admin.";
    $("hero-location").textContent = p.location || "Indonesia";
    $("about-location").textContent = p.location || "Indonesia";
    $("about-email").textContent = p.email || "Email belum ditambahkan";
    $("contact-email").href = p.email ? `mailto:${p.email}` : "#";
    $("contact-email").textContent = p.email ? `Hubungi saya →` : "Email belum ditambahkan";
    $("contact-button").href = p.email ? `mailto:${p.email}` : "#";
    $("profile-name").value = p.name || "";
    $("profile-title").value = p.title || "";
    $("profile-email").value = p.email || "";
    $("profile-location").value = p.location || "";
    $("profile-summary").value = p.summary || "";
    $("profile-about").value = p.about || "";
    $("profile-skills").value = (p.skills || []).join(", ");
    $("profile-cv").value = p.cvUrl || "";
    document.title = `${p.name || "Portofolio"} — Portofolio Online`;
    const cvUrl = safeURL(p.cvUrl || "");
    $("cv-link").hidden = !cvUrl;
    if (cvUrl) $("cv-link").href = cvUrl;
    $("skills-list").innerHTML = (p.skills?.length ? p.skills : ["Komunikasi", "Microsoft Office", "Desain Digital", "Pengembangan Web"]).map(s => `<span>${escapeHTML(s)}</span>`).join("");
  } catch (e) { console.warn("Profil belum bisa dimuat:", e); }
}
async function loadProjects() {
  try {
    const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
    state.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { state.projects = []; }
  $("projects-grid").innerHTML = state.projects.length ? state.projects.map(p => {
    const url = safeURL(p.url || "");
    return `<article class="project-card">${p.imageUrl ? `<img class="project-image" src="${escapeHTML(p.imageUrl)}" alt="Gambar ${escapeHTML(p.name)}" loading="lazy">` : `<div class="project-image project-image-placeholder"><span>PROJECT / ${escapeHTML((p.name || "KARYA").slice(0, 18))}</span></div>`}<div class="project-content"><p class="card-kicker">${escapeHTML(p.tech || "PROYEK PILIHAN")}</p><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description)}</p>${url ? `<a class="text-link" href="${escapeHTML(url)}" target="_blank" rel="noopener">Lihat proyek ↗</a>` : ""}</div></article>`;
  }).join("") : `<div class="empty-state">Proyek akan ditampilkan di sini setelah kamu menambahkannya melalui admin.</div>`;
  $("admin-project-list").innerHTML = state.projects.map(p => `<div class="admin-list-item"><div><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.tech || "Tanpa kategori")}</small></div><div class="list-actions"><button data-edit-project="${p.id}" class="mini-button">Edit</button><button data-delete-project="${p.id}" class="mini-button danger">Hapus</button></div></div>`).join("");
  $("admin-project-list").querySelectorAll("[data-edit-project]").forEach(btn => btn.addEventListener("click", () => editProject(btn.dataset.editProject)));
  $("admin-project-list").querySelectorAll("[data-delete-project]").forEach(btn => btn.addEventListener("click", () => removeProject(btn.dataset.deleteProject)));
}
async function loadCertificates() {
  try {
    const snap = await getDocs(query(collection(db, "certificates"), orderBy("createdAt", "desc")));
    state.certificates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { state.certificates = []; }
  $("certificates-list").innerHTML = state.certificates.length ? state.certificates.map(c => {
    const url = safeURL(c.publicUrl || "");
    return `<article class="certificate-item"><div class="certificate-icon">↗</div><div class="certificate-copy"><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.issuer || "Penerbit tidak dicantumkan")}${c.year ? ` · ${escapeHTML(c.year)}` : ""}</p></div>${url ? `<a class="certificate-link" href="${escapeHTML(url)}" target="_blank" rel="noopener" aria-label="Lihat sertifikat">Lihat ↗</a>` : ""}</article>`;
  }).join("") : `<div class="empty-state">Sertifikat publik akan ditampilkan di sini.</div>`;
  $("admin-certificate-list").innerHTML = state.certificates.map(c => `<div class="admin-list-item"><div><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.issuer || "")}</small></div><button data-delete-cert="${c.id}" class="mini-button danger">Hapus</button></div>`).join("");
  $("admin-certificate-list").querySelectorAll("[data-delete-cert]").forEach(btn => btn.addEventListener("click", () => removeCertificate(btn.dataset.deleteCert)));
}
async function loadPrivateDocs() {
  state.privateDocs = [];
  $("admin-private-list").innerHTML = `<div class="empty-state">Fitur dokumen privat sementara dinonaktifkan pada versi gratis ini.</div>`;
}

onAuthStateChanged(auth, async user => {
  state.user = user;
  $("open-login").textContent = user ? "Panel Admin" : "Admin";
  $("admin-status").textContent = user ? `Login sebagai ${user.email || "admin"} — UID: ${user.uid}` : "Kamu belum login.";
  if (user) { await Promise.all([loadProfile(), loadProjects(), loadCertificates(), loadPrivateDocs()]); }
  else { await Promise.all([loadProfile(), loadProjects(), loadCertificates()]); state.privateDocs = []; $("admin-private-list").innerHTML = ""; }
});

$("profile-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!state.user) return message("profile-message", "Login admin terlebih dahulu.", true);
  const data = {
    name: $("profile-name").value.trim(), title: $("profile-title").value.trim(),
    email: $("profile-email").value.trim(), location: $("profile-location").value.trim(),
    summary: $("profile-summary").value.trim(), about: $("profile-about").value.trim(),
    skills: $("profile-skills").value.split(",").map(s => s.trim()).filter(Boolean),
    cvUrl: $("profile-cv").value.trim(), updatedAt: serverTimestamp()
  };
  try { await setDoc(doc(db, "site", "profile"), data, { merge: true }); message("profile-message", "Profil berhasil disimpan."); await loadProfile(); toast("Profil diperbarui."); }
  catch (err) { message("profile-message", `Gagal menyimpan. Periksa Firebase Rules. ${err.code || ""}`, true); }
});
$("project-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!state.user) return message("project-message", "Login admin terlebih dahulu.", true);
  const id = $("project-id").value;
  const imageUrl = safeURL($("project-image").value.trim());
  if ($("project-image").value.trim() && !imageUrl) return message("project-message", "Masukkan URL gambar yang diawali https:// atau http://.", true);
  try {
    const data = { name: $("project-name").value.trim(), description: $("project-description").value.trim(), tech: $("project-tech").value.trim(), url: $("project-url").value.trim(), imageUrl, updatedAt: serverTimestamp() };
    if (id) await updateDoc(doc(db, "projects", id), data); else await addDoc(collection(db, "projects"), { ...data, createdAt: serverTimestamp() });
    $("project-form").reset(); $("project-id").value = ""; $("project-cancel").hidden = true;
    message("project-message", "Proyek berhasil disimpan."); await loadProjects(); toast("Proyek diperbarui.");
  } catch (err) { message("project-message", `Gagal menyimpan proyek: ${err.message || err.code || "periksa Rules"}`, true); }
});
function editProject(id) {
  const p = state.projects.find(p => p.id === id); if (!p) return;
  $("project-id").value = p.id; $("project-name").value = p.name || ""; $("project-description").value = p.description || ""; $("project-tech").value = p.tech || ""; $("project-url").value = p.url || ""; $("project-image").value = p.imageUrl || ""; $("project-cancel").hidden = false;
  document.querySelector('[data-tab="project"]').click(); $("project-name").focus();
}
$("project-cancel").addEventListener("click", () => { $("project-form").reset(); $("project-id").value = ""; $("project-cancel").hidden = true; });
async function removeProject(id) {
  if (!confirm("Hapus proyek ini?")) return;
  try { await deleteDoc(doc(db, "projects", id)); await loadProjects(); toast("Proyek dihapus."); }
  catch (err) { toast(`Gagal menghapus: ${err.code || "periksa Rules"}`); }
}
$("certificate-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!state.user) return message("certificate-message", "Login admin terlebih dahulu.", true);
  const publicUrl = safeURL($("certificate-url").value.trim());
  if (!publicUrl) return message("certificate-message", "Masukkan tautan sertifikat yang valid (http:// atau https://).", true);
  try {
    const data = { name: $("certificate-name").value.trim(), issuer: $("certificate-issuer").value.trim(), year: $("certificate-year").value.trim(), publicUrl, createdAt: serverTimestamp() };
    await addDoc(collection(db, "certificates"), data);
    $("certificate-form").reset(); message("certificate-message", "Data sertifikat berhasil ditambahkan."); await loadCertificates();
  } catch (err) { message("certificate-message", `Gagal: ${err.message || err.code || "periksa Rules"}`, true); }
});
async function removeCertificate(id) {
  if (!confirm("Hapus data sertifikat ini?")) return;
  try { await deleteDoc(doc(db, "certificates", id)); await loadCertificates(); toast("Sertifikat dihapus dari daftar."); }
  catch (err) { toast(`Gagal menghapus: ${err.code || "periksa Rules"}`); }
}
// Penyimpanan dokumen privat dinonaktifkan sementara agar proyek tetap dapat
// berjalan tanpa Firebase Storage. Jangan simpan dokumen sensitif di folder publik.
$("private-form").addEventListener("submit", e => {
  e.preventDefault();
  message("private-message", "Fitur dokumen privat sementara dinonaktifkan. Jangan unggah KTP, KK, atau dokumen pribadi ke website publik.", true);
});
