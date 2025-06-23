
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

interface HistoricEntry {
  id: string;
  data: string;
  temperatura: number;
  uvi: number;
}

const Historic: React.FC = () => {
  const [historic, setHistoric] = useState<HistoricEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistoric = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'historic'));
        const entries: HistoricEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<HistoricEntry, 'id'>),
        }));
        entries.sort((a, b) => b.data.localeCompare(a.data));
        setHistoric(entries.slice(0, 5));
      } catch (error) {
        console.error('Error carregant l’històric:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoric();
  }, []);

  const handleDeleteAll = async () => {
    const confirm = window.confirm('Segur que vols esborrar tot l’històric?');
    if (!confirm) return;

    try {
      const snapshot = await getDocs(collection(db, 'historic'));
      const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, 'historic', d.id)));
      await Promise.all(deletePromises);
      setHistoric([]);
    } catch (error) {
      console.error('Error esborrant l’històric:', error);
    }
  };

  if (loading) return <p>Carregant l’històric...</p>;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>📅 Històric diari</h3>
      {historic.length === 0 ? (
        <p>No hi ha dades registrades.</p>
      ) : (
        <ul>
          {historic.map((entry) => (
            <li key={entry.id}>
              {entry.data}: {entry.temperatura}°C, UVI: {entry.uvi}
            </li>
          ))}
        </ul>
      )}
     
    </div>
  );
};

export default Historic;
    