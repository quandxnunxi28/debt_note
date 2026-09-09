import React, { useState, useEffect, useMemo } from 'react';
import { Search, PlusCircle, MapPin, User, FileText, CheckCircle, Wallet, Trash2, X, Filter, Clock, AlertTriangle } from 'lucide-react';

// --- HÀM HỖ TRỢ LỌC TIẾNG VIỆT KHÔNG DẤU ---
const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

// --- HÀM TÍNH TOÁN SỐ THÁNG ĐÃ NỢ ---
const getMonthsElapsed = (dateStr) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if(parts.length !== 3) return 0;
  
  // parse ngày từ định dạng DD/MM/YYYY
  const debtDate = new Date(parts[2], parts[1] - 1, parts[0]);
  const now = new Date();
  
  const months = (now.getFullYear() - debtDate.getFullYear()) * 12 + (now.getMonth() - debtDate.getMonth());
  return months;
};

export default function DebtTracker() {
  // 1. STATE LƯU TRỮ DỮ LIỆU
  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem('sosoNoCuaMe');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('Tất cả');
  const [filterTime, setFilterTime] = useState('Tất cả'); // State cho bộ lọc thời gian
  const [isFormOpen, setIsFormOpen] = useState(false);

  // --- STATE PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const RECORDS_PER_PAGE = 8;

  // State cho Form ghi nợ mới
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    amount: '',
    note: ''
  });

  // 2. LƯU DỮ LIỆU
  useEffect(() => {
    localStorage.setItem('sosoNoCuaMe', JSON.stringify(debts));
  }, [debts]);

  // Tự động quay về trang 1 nếu mẹ gõ tìm kiếm hoặc đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterLocation, filterTime]);

  const formatLocationName = (loc) => {
    if (!loc) return '';
    return loc.trim().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
  };

  // 3. TẠO DANH SÁCH KHU VỰC 
  const locationList = useMemo(() => {
    const usedLocs = debts.map(d => formatLocationName(d.location)).filter(Boolean);
    return [...new Set(usedLocs)];
  }, [debts]);

  // 4. LỌC VÀ TÌM KIẾM ĐA ĐIỀU KIỆN
  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      // 4.1. Lọc theo tên (Không dấu)
      const normalizedSearchTerm = removeAccents(searchTerm.toLowerCase().trim());
      const normalizedDebtName = removeAccents(debt.name.toLowerCase());
      const matchSearch = !searchTerm || normalizedDebtName.includes(normalizedSearchTerm);
      
      // 4.2. Lọc theo Khu vực
      const debtLoc = formatLocationName(debt.location);
      const matchFilterLoc = filterLocation === 'Tất cả' || debtLoc === filterLocation;
      
      // 4.3. Lọc theo Thời gian nợ
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

  // --- XỬ LÝ TOÁN HỌC CHO PHÂN TRANG ---
  const totalPages = Math.ceil(filteredDebts.length / RECORDS_PER_PAGE);
  const currentDebts = useMemo(() => {
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    return filteredDebts.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [filteredDebts, currentPage]);

  // Tổng tiền
  const totalDebt = debts.filter(d => !d.isPaid).reduce((sum, d) => sum + Number(d.amount), 0);

  // 5. CÁC HÀM XỬ LÝ
  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      alert("Mẹ nhớ nhập Tên và Số tiền nhé!");
      return;
    }

    const newDebt = {
      id: Date.now(),
      name: formData.name.trim(),
      location: formatLocationName(formData.location),
      amount: formData.amount,
      note: formData.note,
      isPaid: false,
      date: new Date().toLocaleDateString('vi-VN')
    };

    setDebts([newDebt, ...debts]);
    setFormData({ name: '', location: '', amount: '', note: '' }); 
    setIsFormOpen(false); 
    setCurrentPage(1); 
  };

  const togglePaidStatus = (id) => {
    setDebts(debts.map(d => d.id === id ? { ...d, isPaid: !d.isPaid } : d));
  };

  const deleteDebt = (id) => {
    if (window.confirm("Mẹ có chắc chắn muốn xóa hẳn người này khỏi sổ không?")) {
      setDebts(debts.filter(d => d.id !== id));
      if (currentDebts.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>📒 Sổ Ghi Nợ Của Mẹ</h1>
        <div style={styles.summaryCard}>
          <p style={{ margin: 0, fontSize: '1.1rem', color: '#fff', opacity: 0.9 }}>Tổng tiền đang cho nợ:</p>
          <h2 style={{ margin: '5px 0 0 0', fontSize: '2.2rem', color: '#ffea00' }}>
            {formatMoney(totalDebt)}
          </h2>
        </div>
      </div>

      {/* BẢNG ĐIỀU KHIỂN TÌM KIẾM & LỌC */}
      <div style={styles.controlPanel}>
        {/* Tìm kiếm */}
        <div style={styles.searchRow}>
          <Search style={{ color: '#6b7280', marginRight: '10px' }} size={24} />
          <input 
            type="text" 
            placeholder="Tìm tên (gõ không dấu cũng được)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{background:'none', border:'none', padding:0, cursor: 'pointer'}}>
              <X size={20} color="#9ca3af" />
            </button>
          )}
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '12px 0' }}></div>

        {/* Lọc Khu Vực */}
        <div style={styles.filterRow}>
          <Filter style={{ color: '#10b981', marginRight: '10px' }} size={22} />
          <select 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)}
            style={styles.selectInput}
          >
            <option value="Tất cả">Tất cả khu vực</option>
            {locationList.map((loc, idx) => (
              <option key={idx} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '12px 0' }}></div>

        {/* Lọc Thời Gian Nợ */}
        <div style={styles.filterRow}>
          <Clock style={{ color: '#f59e0b', marginRight: '10px' }} size={22} />
          <select 
            value={filterTime} 
            onChange={(e) => setFilterTime(e.target.value)}
            style={{...styles.selectInput, color: '#f59e0b'}}
          >
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

      {/* DANH SÁCH CON NỢ */}
      <div style={styles.listContainer}>
        {currentDebts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
            <FileText size={48} color="#ccc" style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '1.2rem', margin: 0 }}>Không có sổ nợ nào ở đây.</p>
          </div>
        ) : (
          currentDebts.map(debt => {
            const monthsPassed = getMonthsElapsed(debt.date);
            const isLongDebt = !debt.isPaid && monthsPassed >= 12; // Cờ đánh dấu nợ hơn 1 năm

            return (
              <div key={debt.id} style={{...styles.card, opacity: debt.isPaid ? 0.6 : 1, border: isLongDebt ? '2px solid #fca5a5' : '1px solid #e5e7eb'}}>
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <User size={24} color={isLongDebt ? "#ef4444" : "#10b981"} />
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#1f2937', textDecoration: debt.isPaid ? 'line-through' : 'none' }}>
                      {debt.name}
                    </h3>
                    
                    {/* CẢNH BÁO NỢ LÂU NĂM */}
                    {isLongDebt && (
                      <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Quá hạn {Math.floor(monthsPassed / 12)} năm
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#888' }}>{debt.date}</span>
                </div>

                {debt.location && (
                  <div style={styles.infoRow}>
                    <MapPin size={20} color="#6b7280" /> 
                    <span style={{ color: '#4b5563', fontSize: '1.1rem' }}>{debt.location}</span>
                  </div>
                )}
                
                <div style={styles.infoRow}>
                  <Wallet size={20} color={debt.isPaid ? "#10b981" : "#ef4444"} /> 
                  <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: debt.isPaid ? "#10b981" : "#ef4444" }}>
                    {formatMoney(debt.amount)}
                  </span>
                </div>

                {debt.note && (
                  <div style={styles.infoRow}>
                    <FileText size={20} color="#6b7280" /> 
                    <span style={{ fontStyle: 'italic', color: '#4b5563', fontSize: '1.05rem' }}>{debt.note}</span>
                  </div>
                )}

                <div style={styles.cardActions}>
                  <button 
                    onClick={() => togglePaidStatus(debt.id)}
                    style={{...styles.actionBtn, backgroundColor: debt.isPaid ? '#f3f4f6' : '#ecfdf5', color: debt.isPaid ? '#6b7280' : '#10b981', border: `1px solid ${debt.isPaid ? '#d1d5db' : '#10b981'}`}}
                  >
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

      {/* --- CÁC NÚT PHÂN TRANG --- */}
      {totalPages > 1 && (
        <div style={styles.paginationContainer}>
          {Array.from({ length: totalPages }, (_, index) => (
            <button 
              key={index + 1}
              onClick={() => handlePageChange(index + 1)}
              style={{
                ...styles.pageBtn,
                ...(currentPage === index + 1 ? styles.pageBtnActive : {})
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {/* NÚT THÊM NỔI TO ĐÙNG */}
      <button style={styles.fab} onClick={() => setIsFormOpen(true)}>
        <PlusCircle size={32} />
        <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>THÊM SỔ NỢ MỚI</span>
      </button>

      {/* FORM NHẬP LIỆU */}
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
                <input required type="text" style={styles.input} placeholder="VD: Dì Bảy, Cô Tư..." 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div>
                <label style={styles.label}>Nơi ở (Khu vực):</label>
                <input 
                  list="location-list"
                  type="text" 
                  style={styles.input} 
                  placeholder="Chạm để chọn hoặc gõ mới (VD: Yên Đồng)..." 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                />
                <datalist id="location-list">
                  <option value="Yên Đồng" />
                  <option value="Ninh Bình" />
                  {locationList.map((loc, idx) => (
                    <option key={idx} value={loc} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={styles.label}>Số tiền mượn (*):</label>
                <input required type="number" style={styles.input} placeholder="Nhập số (VD: 1500000)" 
                  value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                
                {formData.amount && (
                  <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '10px', border: '2px dashed #ef4444' }}>
                    <p style={{ margin: 0, color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>
                      👉 {formatMoney(formData.amount)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label style={styles.label}>Ghi chú thêm (Không bắt buộc):</label>
                <textarea rows="3" style={styles.input} placeholder="Hẹn đầu tháng trả, mượn mua đồ..." 
                  value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
              </div>

              <button type="submit" style={styles.saveBtn}>LƯU VÀO SỔ NGAY</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- CSS NỘI BỘ TỐI ƯU ---
const styles = {
  container: { maxWidth: '550px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh', paddingBottom: '120px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { backgroundColor: '#10b981', padding: '30px 20px', borderBottomLeftRadius: '25px', borderBottomRightRadius: '25px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' },
  title: { margin: '0 0 20px 0', color: '#fff', fontSize: '1.8rem', textAlign: 'center', fontWeight: 'bold' },
  summaryCard: { backgroundColor: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '15px', textAlign: 'center' },
  
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