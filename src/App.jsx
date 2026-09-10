import React, { useState, useEffect, useMemo } from 'react';
import { Search, PlusCircle, MapPin, User, FileText, CheckCircle, Wallet, Trash2, X, Filter, Clock, AlertTriangle, Lock } from 'lucide-react';

// --- 1. KẾT NỐI GOOGLE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

// 👇 BẠN HÃY THAY ĐOẠN CONFIG NÀY BẰNG MÃ BẠN LẤY TỪ FIREBASE BƯỚC 2 NHÉ 👇
const firebaseConfig = {
  apiKey: "AIzaSyCJvASEh_kfQcOyDB89VOzVlTOId8-2Y9U",
  authDomain: "ghino-7a25c.firebaseapp.com",
  projectId: "ghino-7a25c",
  storageBucket: "ghino-7a25c.firebasestorage.app",
  messagingSenderId: "993743747243",
  appId: "1:993743747243:web:5870b5a8287002e49edfee",
  measurementId: "G-C0KDP1FNNR"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const debtsCollection = collection(db, 'debts'); // Tên bảng dữ liệu là 'debts'

// --- CÀI ĐẶT MÃ PIN BẢO MẬT KHÓA MÀN HÌNH ---
const SECRET_PIN = "6868"; 

// --- HÀM HỖ TRỢ LỌC TIẾNG VIỆT KHÔNG DẤU ---
const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

const getMonthsElapsed = (dateStr) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if(parts.length !== 3) return 0;
  const debtDate = new Date(parts[2], parts[1] - 1, parts[0]);
  const now = new Date();
  return (now.getFullYear() - debtDate.getFullYear()) * 12 + (now.getMonth() - debtDate.getMonth());
};

export default function DebtTracker() {
  // --- STATE KHÓA MÀN HÌNH ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // --- STATE LƯU TRỮ DỮ LIỆU ĐÁM MÂY ---
  const [debts, setDebts] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Thêm state chờ tải dữ liệu

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('Tất cả');
  const [filterTime, setFilterTime] = useState('Tất cả');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const RECORDS_PER_PAGE = 8;

  const [formData, setFormData] = useState({
    name: '', location: '', amount: '', note: ''
  });

  // --- 2. LẤY DỮ LIỆU THỰC TẾ (REAL-TIME) TỪ FIREBASE ---
  useEffect(() => {
    // onSnapshot giúp dữ liệu cập nhật ngay lập tức nếu có thay đổi trên server
    const unsubscribe = onSnapshot(debtsCollection, (snapshot) => {
      const debtsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sắp xếp người mới thêm lên đầu
      debtsData.sort((a, b) => b.createdAt - a.createdAt);
      setDebts(debtsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Lỗi khi tải dữ liệu:", error);
      alert("Lỗi mạng! Không thể kết nối với máy chủ.");
    });

    // Hủy lắng nghe khi thoát app
    return () => unsubscribe();
  }, []);

  // Các xử lý tự động
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterLocation, filterTime]);

  const formatLocationName = (loc) => {
    if (!loc) return '';
    return loc.trim().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
  };

  const locationList = useMemo(() => {
    const usedLocs = debts.map(d => formatLocationName(d.location)).filter(Boolean);
    return [...new Set(usedLocs)];
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      const normalizedSearchTerm = removeAccents(searchTerm.toLowerCase().trim());
      const normalizedDebtName = removeAccents(debt.name.toLowerCase());
      const matchSearch = !searchTerm || normalizedDebtName.includes(normalizedSearchTerm);
      
      const debtLoc = formatLocationName(debt.location);
      const matchFilterLoc = filterLocation === 'Tất cả' || debtLoc === filterLocation;
      
      const monthsElapsed = getMonthsElapsed(debt.date);
      let matchFilterTime = true;
      if (filterTime === 'Dưới 6 tháng') matchFilterTime = monthsElapsed < 6;
      else if (filterTime === 'Từ 6 - 12 tháng') matchFilterTime = monthsElapsed >= 6 && monthsElapsed < 12;
      else if (filterTime === 'Hơn 1 năm') matchFilterTime = monthsElapsed >= 12;
      else if (filterTime === 'Hơn 2 năm') matchFilterTime = monthsElapsed >= 24;
      else if (filterTime === 'Hơn 3 năm') matchFilterTime = monthsElapsed >= 36;
      else if (filterTime === 'Hơn 4 năm') matchFilterTime = monthsElapsed >= 48;

      return matchSearch && matchFilterLoc && matchFilterTime; 
    });
  }, [debts, searchTerm, filterLocation, filterTime]);

  const totalPages = Math.ceil(filteredDebts.length / RECORDS_PER_PAGE);
  const currentDebts = useMemo(() => {
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    return filteredDebts.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [filteredDebts, currentPage]);

  const totalDebt = debts.filter(d => !d.isPaid).reduce((sum, d) => sum + Number(d.amount), 0);

  // --- 3. CÁC HÀM XỬ LÝ DATABASE ĐÁM MÂY ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === SECRET_PIN) {
      setIsUnlocked(true); setPinError(false); setPinInput('');
    } else { setPinError(true); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      alert("Mẹ nhớ nhập Tên và Số tiền nhé!"); return;
    }
    
    const newDebt = {
      name: formData.name.trim(),
      location: formatLocationName(formData.location),
      amount: formData.amount,
      note: formData.note,
      isPaid: false,
      date: new Date().toLocaleDateString('vi-VN'),
      createdAt: Date.now() // Dùng để sắp xếp
    };

    try {
      // Đẩy dữ liệu lên Firebase
      await addDoc(debtsCollection, newDebt);
      setFormData({ name: '', location: '', amount: '', note: '' }); 
      setIsFormOpen(false); 
      setCurrentPage(1);
    } catch (error) {
      alert("Có lỗi xảy ra khi lưu. Vui lòng kiểm tra lại mạng!");
    }
  };

  const togglePaidStatus = async (id, currentStatus) => {
    try {
      // Cập nhật trạng thái trả nợ trên Firebase
      const debtDoc = doc(db, 'debts', id);
      await updateDoc(debtDoc, { isPaid: !currentStatus });
    } catch (error) {
      alert("Không thể cập nhật trạng thái!");
    }
  };

  const deleteDebt = async (id) => {
    if (window.confirm("Mẹ có chắc chắn muốn xóa hẳn người này khỏi sổ không? Dữ liệu sẽ mất vĩnh viễn!")) {
      try {
        // Xóa hoàn toàn trên Firebase
        const debtDoc = doc(db, 'debts', id);
        await deleteDoc(debtDoc);
        if (currentDebts.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
      } catch (error) {
        alert("Xóa thất bại!");
      }
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  const handlePageChange = (pageNumber) => { setCurrentPage(pageNumber); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ==========================================
  // GIAO DIỆN 1: MÀN HÌNH KHÓA
  // ==========================================
  if (!isUnlocked) {
    return (
      <div style={{...styles.container, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', minHeight: '100vh'}}>
        <div style={{ backgroundColor: '#fff', padding: '40px 30px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '85%', maxWidth: '350px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#ecfdf5', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto' }}>
            <Lock size={40} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '1.6rem' }}>Sổ Nợ Riêng Tư</h2>
          <p style={{ color: '#6b7280', marginBottom: '25px', fontSize: '1rem' }}>Vui lòng nhập mã PIN để mở sổ</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" inputMode="numeric" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              style={{ width: '100%', padding: '15px', fontSize: '2rem', textAlign: 'center', letterSpacing: '10px', borderRadius: '12px', border: pinError ? '2px solid #ef4444' : '2px solid #d1d5db', boxSizing: 'border-box', marginBottom: '15px' }}
            />
            {pinError && <p style={{ color: '#ef4444', margin: '0 0 15px 0', fontWeight: 'bold' }}>Mã PIN sai, thử lại nhé!</p>}
            <button type="submit" style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
              MỞ SỔ
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN 2: ỨNG DỤNG SỔ NỢ CHÍNH
  // ==========================================
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={styles.title}>📒 Sổ Ghi Nợ Của Mẹ</h1>
          <button onClick={() => setIsUnlocked(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Lock size={16} /> Khóa sổ
          </button>
        </div>
        
        <div style={styles.summaryCard}>
          <p style={{ margin: 0, fontSize: '1.1rem', color: '#fff', opacity: 0.9 }}>Tổng tiền đang cho nợ:</p>
          <h2 style={{ margin: '5px 0 0 0', fontSize: '2.2rem', color: '#ffea00' }}>
            {formatMoney(totalDebt)}
          </h2>
        </div>
      </div>

      <div style={styles.controlPanel}>
        <div style={styles.searchRow}>
          <Search style={{ color: '#6b7280', marginRight: '10px' }} size={24} />
          <input 
            type="text" placeholder="Tìm tên (gõ không dấu cũng được)..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{background:'none', border:'none', padding:0, cursor: 'pointer'}}><X size={20} color="#9ca3af" /></button>
          )}
        </div>
        <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '12px 0' }}></div>
        <div style={styles.filterRow}>
          <Filter style={{ color: '#10b981', marginRight: '10px' }} size={22} />
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={styles.selectInput}>
            <option value="Tất cả">Tất cả khu vực</option>
            {locationList.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
          </select>
        </div>
        <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '12px 0' }}></div>
        <div style={styles.filterRow}>
          <Clock style={{ color: '#f59e0b', marginRight: '10px' }} size={22} />
          <select value={filterTime} onChange={(e) => setFilterTime(e.target.value)} style={{...styles.selectInput, color: '#f59e0b'}}>
            <option value="Tất cả">Tất cả thời gian</option>
            <option value="Dưới 6 tháng">Mới nợ (Dưới 6 tháng)</option>
            <option value="Từ 6 - 12 tháng">Nợ 6 tháng - 1 năm</option>
            <option value="Hơn 1 năm">Nợ hơn 1 năm</option>
            <option value="Hơn 2 năm">Nợ hơn 2 năm</option>
            <option value="Hơn 3 năm">Nợ hơn 3 năm</option>
            <option value="Hơn 4 năm">Nợ hơn 4 năm</option>
          </select>
        </div>
      </div>

      <div style={styles.listContainer}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }}>Đang tải dữ liệu từ máy chủ...</p>
        ) : currentDebts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
            <FileText size={48} color="#ccc" style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '1.2rem', margin: 0 }}>Không có sổ nợ nào ở đây.</p>
          </div>
        ) : (
          currentDebts.map(debt => {
            const monthsPassed = getMonthsElapsed(debt.date);
            const isLongDebt = !debt.isPaid && monthsPassed >= 12;

            return (
              <div key={debt.id} style={{...styles.card, opacity: debt.isPaid ? 0.6 : 1, border: isLongDebt ? '2px solid #fca5a5' : '1px solid #e5e7eb'}}>
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <User size={24} color={isLongDebt ? "#ef4444" : "#10b981"} />
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#1f2937', textDecoration: debt.isPaid ? 'line-through' : 'none' }}>
                      {debt.name}
                    </h3>
                    {isLongDebt && (
                      <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Quá hạn {Math.floor(monthsPassed / 12)} năm
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#888' }}>{debt.date}</span>
                </div>

                {debt.location && (
                  <div style={styles.infoRow}><MapPin size={20} color="#6b7280" /> <span style={{ color: '#4b5563', fontSize: '1.1rem' }}>{debt.location}</span></div>
                )}
                
                <div style={styles.infoRow}>
                  <Wallet size={20} color={debt.isPaid ? "#10b981" : "#ef4444"} /> 
                  <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: debt.isPaid ? "#10b981" : "#ef4444" }}>
                    {formatMoney(debt.amount)}
                  </span>
                </div>

                {debt.note && (
                  <div style={styles.infoRow}><FileText size={20} color="#6b7280" /> <span style={{ fontStyle: 'italic', color: '#4b5563', fontSize: '1.05rem' }}>{debt.note}</span></div>
                )}

                <div style={styles.cardActions}>
                  <button onClick={() => togglePaidStatus(debt.id, debt.isPaid)} style={{...styles.actionBtn, backgroundColor: debt.isPaid ? '#f3f4f6' : '#ecfdf5', color: debt.isPaid ? '#6b7280' : '#10b981', border: `1px solid ${debt.isPaid ? '#d1d5db' : '#10b981'}`}}>
                    <CheckCircle size={22} /> {debt.isPaid ? 'Mở lại sổ' : 'Đã Trả Xong'}
                  </button>
                  <button onClick={() => deleteDebt(debt.id)} style={styles.deleteBtn}>
                    <Trash2 size={22} /> Xóa
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div style={styles.paginationContainer}>
          {Array.from({ length: totalPages }, (_, index) => (
            <button key={index + 1} onClick={() => handlePageChange(index + 1)} style={{...styles.pageBtn, ...(currentPage === index + 1 ? styles.pageBtnActive : {})}}>
              {index + 1}
            </button>
          ))}
        </div>
      )}

      <button style={styles.fab} onClick={() => setIsFormOpen(true)}>
        <PlusCircle size={32} />
        <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>THÊM SỔ NỢ MỚI</span>
      </button>

      {isFormOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ margin: 0, color: '#1f2937', fontSize: '1.6rem' }}>✍️ Ghi sổ nợ mới</h2>
              <button onClick={() => setIsFormOpen(false)} style={styles.closeBtn}><X size={32} /></button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={styles.label}>Tên người mượn (*):</label>
                <input required type="text" style={styles.input} placeholder="VD: Dì Bảy, Cô Tư..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label style={styles.label}>Nơi ở (Khu vực):</label>
                <input list="location-list" type="text" style={styles.input} placeholder="Chạm để chọn hoặc gõ mới (VD: Yên Đồng)..." value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                <datalist id="location-list">
                  <option value="Yên Đồng" />
                  <option value="Ninh Bình" />
                  {locationList.map((loc, idx) => <option key={idx} value={loc} />)}
                </datalist>
              </div>
              <div>
                <label style={styles.label}>Số tiền mượn (*):</label>
                <input required type="number" style={styles.input} placeholder="Nhập số (VD: 1500000)" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                {formData.amount && (
                  <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '10px', border: '2px dashed #ef4444' }}>
                    <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>👉 {formatMoney(formData.amount)}</p>
                  </div>
                )}
              </div>
              <div>
                <label style={styles.label}>Ghi chú thêm (Không bắt buộc):</label>
                <textarea rows="3" style={styles.input} placeholder="Hẹn đầu tháng trả, mượn mua đồ..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
              </div>
              <button type="submit" style={styles.saveBtn}>LƯU VÀO SỔ NGAY</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: '550px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh', paddingBottom: '120px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { backgroundColor: '#10b981', padding: '30px 20px', borderBottomLeftRadius: '25px', borderBottomRightRadius: '25px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' },
  title: { margin: 0, color: '#fff', fontSize: '1.8rem', fontWeight: 'bold' },
  summaryCard: { backgroundColor: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '15px', textAlign: 'center', marginTop: '15px' },
  controlPanel: { backgroundColor: '#fff', margin: '20px', padding: '15px 20px', borderRadius: '20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
  searchRow: { display: 'flex', alignItems: 'center' },
  searchInput: { border: 'none', outline: 'none', width: '100%', fontSize: '1.15rem', color: '#1f2937' },
  filterRow: { display: 'flex', alignItems: 'center' },
  selectInput: { border: 'none', outline: 'none', width: '100%', fontSize: '1.15rem', color: '#10b981', fontWeight: 'bold', backgroundColor: 'transparent', cursor: 'pointer' },
  listContainer: { padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', transition: '0.3s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #e5e7eb', paddingBottom: '15px', marginBottom: '15px' },
  infoRow: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', color: '#374151' },
  cardActions: { display: 'flex', gap: '12px', marginTop: '25px' },
  actionBtn: { flex: 2.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '15px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  deleteBtn: { flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', border: 'none', color: '#ef4444', padding: '15px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' },
  paginationContainer: { display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px', paddingBottom: '20px', flexWrap: 'wrap' },
  pageBtn: { padding: '12px 20px', borderRadius: '12px', border: '2px solid #e5e7eb', backgroundColor: '#fff', fontSize: '1.2rem', fontWeight: 'bold', color: '#374151', cursor: 'pointer', transition: '0.2s' },
  pageBtnActive: { backgroundColor: '#10b981', color: '#fff', borderColor: '#10b981' },
  fab: { position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '18px 40px', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)', cursor: 'pointer', zIndex: 100 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modalContent: { backgroundColor: '#fff', padding: '30px 25px', borderRadius: '24px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' },
  closeBtn: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' },
  label: { fontSize: '1.15rem', fontWeight: 'bold', color: '#374151' },
  input: { width: '100%', padding: '16px', border: '2px solid #d1d5db', borderRadius: '12px', fontSize: '1.2rem', marginTop: '8px', boxSizing: 'border-box' },
  saveBtn: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '14px', fontSize: '1.3rem', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }
};