'use client';

import { useState, useEffect } from 'react';
import {
  doc,
  collection,
  query,
  onSnapshot,
  getDocs,
  getDoc,
  type Query,
  type DocumentData,
  type QueryConstraint,
  type DocumentReference,
} from 'firebase/firestore';
import { getClientFirestore } from './client';

function getConstraintKey(constraints: QueryConstraint[]) {
  try {
    return JSON.stringify(constraints);
  } catch {
    return constraints.map((constraint) => constraint.type).join('|');
  }
}

export function useDocument<T>(collectionName: string, docId: string | undefined) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getClientFirestore();
    const docRef = doc(db, collectionName, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [collectionName, docId]);

  return { data, loading, error };
}

export function useCollection<T>(
  collectionName: string | undefined,
  constraints: QueryConstraint[] = [],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const constraintsKey = getConstraintKey(constraints);

  useEffect(() => {
    if (!collectionName) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getClientFirestore();
    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [collectionName, constraintsKey]);

  return { data, loading, error };
}

export { doc, collection, query, getDocs, getDoc, getClientFirestore };
export {
  where,
  orderBy,
  limit,
  startAfter,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
