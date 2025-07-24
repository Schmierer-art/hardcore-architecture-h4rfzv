import { useState, useEffect, useMemo, useRef } from "react"; // useRef hinzufügen
import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const hours = Array.from({ length: 8 }, (_, i) => `${i + 1}. Stunde`);

const farboptionen = [
  "bg-red-100",
  "bg-yellow-100",
  "bg-blue-100",
  "bg-green-100",
  "bg-pink-100",
  "bg-purple-100",
  "bg-orange-100",
  "bg-gray-100",
  "bg-indigo-100",
  "bg-teal-100",
];

const berlinFerien = [
  {
    name: "Winterferien",
    start: new Date(2025, 1, 3),
    end: new Date(2025, 1, 8),
  },
  {
    name: "Osterferien",
    start: new Date(2025, 3, 7),
    end: new Date(2025, 3, 19),
  },
  {
    name: "Sommerferien",
    start: new Date(2025, 6, 24),
    end: new Date(2025, 8, 6),
  },
];

berlinFerien.forEach((holiday) => {
  holiday.start.setHours(0, 0, 0, 0);
  holiday.end.setHours(23, 59, 59, 999);
});

export default function StundenplanApp() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [todoData, setTodoData] = useState({});
  const [viewMode, setViewMode] = useState("week");
  const [fachName, setFachName] = useState("");
  const [fachFarbe, setFachFarbe] = useState(farboptionen[0]);
  const [fachZeiten, setFachZeiten] = useState({});
  const [fächer, setFächer] = useState([]);
  const [bearbeiteIndex, setBearbeiteIndex] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState("");
  const [hideCompletedTodos, setHideCompletedTodos] = useState(false);
  const [ferienDaten, setFerienDaten] = useState(berlinFerien);
  const [isLoading, setIsLoading] = useState(true);

  // Neuer State für das benutzerdefinierte Dropdown
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const colorDropdownRef = useRef(null); // Ref für das Klicken außerhalb

  // Hook, um Klicks außerhalb des Dropdowns zu schließen
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        colorDropdownRef.current &&
        !colorDropdownRef.current.contains(event.target)
      ) {
        setIsColorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [colorDropdownRef]);

  // --- Firebase Loading Data (Subjects and Todos) ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fächer laden
        const faecherRef = collection(db, "faecher");
        const faecherSnapshot = await getDocs(query(faecherRef));
        const loadedFaecher = faecherSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setFächer(loadedFaecher);

        // To-Dos laden
        const todosRef = collection(db, "todos");
        const todosSnapshot = await getDocs(query(todosRef));
        const loadedTodos = {};
        todosSnapshot.docs.forEach((doc) => {
          // Die ID des Dokuments ist der Schlüssel (kw-day-hourIndex)
          const docIdParts = doc.id.split("-");
          const kw = parseInt(docIdParts[0]);
          const day = docIdParts[1];
          const hourIndex = parseInt(docIdParts[2]);

          const { text, done } = doc.data();
          if (!loadedTodos[kw]) loadedTodos[kw] = {};
          if (!loadedTodos[kw][day]) loadedTodos[kw][day] = [];
          loadedTodos[kw][day][hourIndex] = { text, done };
        });
        setTodoData(loadedTodos);
      } catch (error) {
        console.error("Fehler beim Laden der Daten von Firestore:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // --- Firebase Saving Fächer ---
  useEffect(() => {
    if (isLoading || fächer.length === 0) return;

    const saveFaecher = async () => {
      try {
        const faecherRef = collection(db, "faecher");
        const faecherSnapshot = await getDocs(query(faecherRef));
        const batch = writeBatch(db);

        faecherSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        for (const fach of fächer) {
          const docRef = doc(faecherRef, fach.id || Date.now().toString());
          batch.set(docRef, {
            name: fach.name,
            farbe: fach.farbe,
            zeiten: fach.zeiten,
          });
        }
        await batch.commit();
        console.log("Fächer erfolgreich in Firestore gespeichert!");
      } catch (error) {
        console.error("Fehler beim Speichern der Fächer in Firestore:", error);
      }
    };

    saveFaecher();
  }, [fächer, isLoading]);

  const isHoliday = (date) => {
    for (const ferien of ferienDaten) {
      if (date >= ferien.start && date <= ferien.end) {
        return ferien.name;
      }
    }
    return null;
  };

  const getCurrentWeek = (offset = 0) => {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + offset * 7);
    const firstJan = new Date(currentDate.getFullYear(), 0, 1);
    const pastDays = Math.floor(
      (currentDate - firstJan) / (24 * 60 * 60 * 1000)
    );
    return Math.ceil((pastDays + firstJan.getDay() + 1) / 7);
  };

  const getDateForDay = (baseOffset, dayIndex) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    startOfWeek.setDate(
      today.getDate() + baseOffset * 7 + mondayOffset + dayIndex
    );
    startOfWeek.setHours(0, 0, 0, 0);
    return {
      formatted: startOfWeek.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }),
      dateObject: startOfWeek,
    };
  };

  const currentKW = getCurrentWeek(weekOffset);

  const updateTodo = async (day, hourIndex, value) => {
    const todosRef = collection(db, "todos");
    const docId = `${currentKW}-${day}-${hourIndex}`;
    const docRef = doc(todosRef, docId);

    const currentTodoItem = todoData[currentKW]?.[day]?.[hourIndex] || {
      text: "",
      done: false,
    };

    setTodoData((prev) => {
      const week = prev[currentKW] || {};
      const dayTodos = week[day] || [];
      const newTodos = [...dayTodos];
      newTodos[hourIndex] = { ...currentTodoItem, text: value };
      return {
        ...prev,
        [currentKW]: {
          ...week,
          [day]: newTodos,
        },
      };
    });

    try {
      if (value.trim() === "") {
        await deleteDoc(docRef);
        console.log(`To-Do ${docId} erfolgreich aus Firestore gelöscht.`);
      } else {
        await setDoc(docRef, {
          kw: currentKW,
          day,
          hourIndex,
          text: value,
          done: currentTodoItem.done,
        });
        console.log(`To-Do ${docId} erfolgreich in Firestore gespeichert.`);
      }
    } catch (error) {
      console.error(
        `Fehler beim Speichern/Löschen des To-Dos ${docId}:`,
        error
      );
    }
  };

  const toggleTodoDone = async (kw, day, hourIndex) => {
    const todosRef = collection(db, "todos");
    const docId = `${kw}-${day}-${hourIndex}`;
    const docRef = doc(todosRef, docId);

    const currentTodoItem = todoData[kw]?.[day]?.[hourIndex] || {
      text: "",
      done: false,
    };
    const newDoneStatus = !currentTodoItem.done;

    setTodoData((prev) => {
      const week = prev[kw] || {};
      const dayTodos = week[day] || [];
      const newTodos = [...dayTodos];
      newTodos[hourIndex] = { ...currentTodoItem, done: newDoneStatus };
      return {
        ...prev,
        [kw]: {
          ...week,
          [day]: newTodos,
        },
      };
    });

    try {
      await setDoc(docRef, { done: newDoneStatus }, { merge: true });
      console.log(`To-Do ${docId} 'done' Status aktualisiert in Firestore.`);
    } catch (error) {
      console.error(
        `Fehler beim Aktualisieren des 'done'-Status des To-Dos ${docId}:`,
        error
      );
    }
  };

  const deleteTodo = async (kw, day, hourIndex) => {
    const confirmDelete = window.confirm(
      "Möchten Sie dieses To-Do wirklich löschen?"
    );
    if (!confirmDelete) return;

    const todosRef = collection(db, "todos");
    const docId = `${kw}-${day}-${hourIndex}`;
    const docRef = doc(todosRef, docId);

    setTodoData((prev) => {
      const week = prev[kw] || {};
      const dayTodos = week[day] || [];
      const newTodos = [...dayTodos];
      newTodos[hourIndex] = { text: "", done: false };
      return {
        ...prev,
        [kw]: {
          ...week,
          [day]: newTodos,
        },
      };
    });

    try {
      await deleteDoc(docRef);
      console.log(`To-Do ${docId} erfolgreich gelöscht aus Firestore.`);
    } catch (error) {
      console.error(`Fehler beim Löschen des To-Dos ${docId}:`, error);
    }
  };

  const startEditingTodo = (kw, day, hourIndex, text) => {
    setEditingTodo({ kw, day, hourIndex });
    setEditingTodoText(text);
  };

  const saveEditedTodo = async () => {
    if (!editingTodo) return;
    const { kw, day, hourIndex } = editingTodo;
    const todosRef = collection(db, "todos");
    const docId = `${kw}-${day}-${hourIndex}`;
    const docRef = doc(todosRef, docId);

    const currentTodoItem = todoData[kw]?.[day]?.[hourIndex] || {
      text: "",
      done: false,
    };

    setTodoData((prev) => {
      const week = prev[kw] || {};
      const dayTodos = week[day] || [];
      const newTodos = [...dayTodos];
      newTodos[hourIndex] = { ...currentTodoItem, text: editingTodoText };
      return {
        ...prev,
        [kw]: {
          ...week,
          [day]: newTodos,
        },
      };
    });

    try {
      if (editingTodoText.trim() === "") {
        await deleteDoc(docRef);
        console.log(`To-Do ${docId} nach Bearbeitung als leer gelöscht.`);
      } else {
        await setDoc(docRef, {
          kw,
          day,
          hourIndex,
          text: editingTodoText,
          done: currentTodoItem.done,
        });
        console.log(`To-Do ${docId} nach Bearbeitung aktualisiert.`);
      }
    } catch (error) {
      console.error(
        `Fehler beim Speichern des bearbeiteten To-Dos ${docId}:`,
        error
      );
    }

    setEditingTodo(null);
    setEditingTodoText("");
  };

  const cancelEditingTodo = () => {
    setEditingTodo(null);
    setEditingTodoText("");
  };

  const defaultSchedule = useMemo(() => {
    return days.reduce((acc, day) => {
      acc[day] = hours.map((_, hourIndex) => {
        for (const fach of fächer) {
          if (fach.zeiten[`${day}-${hourIndex}`]) {
            return { fach: fach.name, farbe: fach.farbe };
          }
        }
        return {};
      });
      return acc;
    }, {});
  }, [fächer]);

  const occupiedSlots = useMemo(() => {
    const occupied = {};
    fächer.forEach((fach, index) => {
      if (bearbeiteIndex !== null && index === bearbeiteIndex) {
        return;
      }
      for (const key in fach.zeiten) {
        if (fach.zeiten[key]) {
          occupied[key] = true;
        }
      }
    });
    return occupied;
  }, [fächer, bearbeiteIndex]);

  const weekScheduleBlocks = useMemo(() => {
    const blocks = {};
    days.forEach((day) => {
      blocks[day] = [];
      let currentBlock = null;

      hours.forEach((_, hourIndex) => {
        const fachInfo = defaultSchedule[day]?.[hourIndex];

        if (fachInfo?.fach) {
          if (
            currentBlock &&
            currentBlock.fach === fachInfo.fach &&
            currentBlock.farbe === fachInfo.farbe
          ) {
            currentBlock.endHourIndex = hourIndex;
            currentBlock.duration++;
          } else {
            if (currentBlock) {
              blocks[day].push(currentBlock);
            }
            currentBlock = {
              fach: fachInfo.fach,
              farbe: fachInfo.farbe,
              startHourIndex: hourIndex,
              endHourIndex: hourIndex,
              duration: 1,
            };
          }
        } else {
          if (currentBlock) {
            blocks[day].push(currentBlock);
          }
          const isCoveredByPreviousBlock = blocks[day].some(
            (block) =>
              block.startHourIndex < hourIndex &&
              block.endHourIndex >= hourIndex
          );

          if (!isCoveredByPreviousBlock) {
            blocks[day].push({
              fach: null,
              startHourIndex: hourIndex,
              endHourIndex: hourIndex,
              duration: 1,
            });
          }
          currentBlock = null;
        }
      });

      if (currentBlock) {
        blocks[day].push(currentBlock);
      }
    });
    return blocks;
  }, [defaultSchedule]);

  const toggleFachZeit = (day, hourIndex) => {
    const key = `${day}-${hourIndex}`;
    const isCurrentlySelected = fachZeiten[key];

    if (!isCurrentlySelected && occupiedSlots[key]) {
      return;
    }

    setFachZeiten((prev) => ({
      ...prev,
      [key]: !isCurrentlySelected,
    }));
  };

  const handleFachSpeichern = async () => {
    if (!fachName.trim()) {
      alert("Bitte geben Sie einen Fachnamen ein.");
      return;
    }

    const faecherRef = collection(db, "faecher");
    const neuesFach = {
      name: fachName,
      farbe: fachFarbe,
      zeiten: { ...fachZeiten },
    };

    try {
      if (bearbeiteIndex !== null && fächer[bearbeiteIndex]?.id) {
        const docRef = doc(faecherRef, fächer[bearbeiteIndex].id);
        await setDoc(docRef, neuesFach);
        setFächer((prev) =>
          prev.map((f, i) =>
            i === bearbeiteIndex ? { ...neuesFach, id: f.id } : f
          )
        );
      } else {
        const newDocRef = doc(faecherRef);
        await setDoc(newDocRef, neuesFach);
        setFächer((prev) => [...prev, { ...neuesFach, id: newDocRef.id }]);
      }
      console.log("Fach gespeichert/aktualisiert!");
    } catch (error) {
      console.error("Fehler beim Speichern/Aktualisieren des Fachs:", error);
    }

    setFachName("");
    setFachFarbe(farboptionen[0]);
    setFachZeiten({});
    setBearbeiteIndex(null);
  };

  const handleFachLöschen = async (index) => {
    const fachToDelete = fächer[index];
    if (!fachToDelete || !fachToDelete.id) {
      console.error("Fach oder Fach-ID zum Löschen nicht gefunden.");
      return;
    }

    const confirmDelete = window.confirm(
      `Möchten Sie das Fach "${fachToDelete.name}" wirklich löschen?`
    );
    if (!confirmDelete) return;

    try {
      const fachDocRef = doc(db, "faecher", fachToDelete.id);
      await deleteDoc(fachDocRef);

      setTodoData((prevTodoData) => {
        const newTodoData = { ...prevTodoData };
        for (const kw in newTodoData) {
          for (const day in newTodoData[kw]) {
            for (
              let hourIndex = 0;
              hourIndex < (newTodoData[kw][day] || []).length;
              hourIndex++
            ) {
              const key = `${day}-${hourIndex}`;
              if (fachToDelete.zeiten[key]) {
                newTodoData[kw][day][hourIndex] = { text: "", done: false };
                const todoDocRef = doc(
                  db,
                  "todos",
                  `${kw}-${day}-${hourIndex}`
                );
                deleteDoc(todoDocRef).catch((e) =>
                  console.error("Fehler beim Löschen zugehöriger ToDos:", e)
                );
              }
            }
          }
        }
        return newTodoData;
      });

      setFächer((prev) => prev.filter((_, i) => i !== index));
      console.log("Fach erfolgreich gelöscht!");
    } catch (error) {
      console.error("Fehler beim Löschen des Fachs:", error);
    }
  };

  const handleFachBearbeiten = (index) => {
    const fach = fächer[index];
    setFachName(fach.name);
    setFachFarbe(fach.farbe);
    setFachZeiten(fach.zeiten);
    setBearbeiteIndex(index);
  };

  const handleAbbrechen = () => {
    setFachName("");
    setFachFarbe(farboptionen[0]);
    setFachZeiten({});
    setBearbeiteIndex(null);
  };

  const today = new Date();
  const currentDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const firstHalfDays = ["Montag", "Dienstag", "Mittwoch"];
  const secondHalfDays = ["Donnerstag", "Freitag"];

  const renderTableSection = (daysToRender) => (
    <table className="min-w-full border-collapse">
      <thead>
        <tr>
          {/* Removed the "Stunde" header */}
          {daysToRender.map((day, dayIndexOffset) => {
            const actualDayIndex = days.indexOf(day);
            const dayInfo = getDateForDay(weekOffset, actualDayIndex);
            const ferienName = isHoliday(dayInfo.dateObject);
            return (
              <th
                key={day}
                className={`border-b-2 border-gray-300 p-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider md:p-3 md:text-sm
                  ${
                    weekOffset === 0 && actualDayIndex === currentDayIndex
                      ? "bg-blue-50 border-blue-300"
                      : ""
                  }
                  ${ferienName ? "bg-green-50 border-green-300" : ""}
                `}
              >
                <div className="font-bold text-base md:text-lg">{day}</div>
                <div className="text-xs text-gray-500">{dayInfo.formatted}</div>
                {ferienName && (
                  <div className="text-xs text-green-700 font-bold mt-1">
                    ({ferienName})
                  </div>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {hours.map((hourLabel, hourIndex) => {
          return (
            <tr key={hourIndex} className="hover:bg-gray-50">
              {/* Removed the hourLabel cell */}
              {daysToRender.map((day) => {
                const actualDayIndex = days.indexOf(day);
                const dayInfo = getDateForDay(weekOffset, actualDayIndex);
                const ferienName = isHoliday(dayInfo.dateObject);

                const isCoveredByPreviousBlock = weekScheduleBlocks[day].some(
                  (block) =>
                    block.startHourIndex < hourIndex &&
                    block.endHourIndex >= hourIndex
                );

                if (isCoveredByPreviousBlock) {
                  return null;
                }

                const block = weekScheduleBlocks[day].find(
                  (b) => b.startHourIndex === hourIndex
                );

                const displayBlock = block || {
                  fach: null,
                  startHourIndex: hourIndex,
                  endHourIndex: hourIndex,
                  duration: 1,
                };

                const todoItem = todoData[currentKW]?.[day]?.[hourIndex] || {
                  text: "",
                  done: false,
                };
                const todoText = todoItem.text;

                const displayFachName = displayBlock.fach;
                const displayDuration =
                  displayBlock.duration > 1
                    ? ` (${displayBlock.duration} Std.)`
                    : "";

                return (
                  <td
                    key={`${day}-${hourIndex}`}
                    rowSpan={displayBlock.duration}
                    className={`border-b border-gray-200 p-2 align-top rounded-md md:p-3
                      ${
                        displayBlock.fach
                          ? displayBlock.farbe || "bg-gray-100"
                          : "bg-white"
                      }
                      ${
                        weekOffset === 0 && actualDayIndex === currentDayIndex
                          ? "bg-blue-50 border-blue-300"
                          : ""
                      }
                      ${ferienName ? "bg-green-50 border-green-300" : ""}
                    `}
                  >
                    {displayFachName ? (
                      <>
                        <div className="font-semibold text-sm text-gray-800 mb-1 md:text-base">
                          {displayFachName}
                          <span className="text-xs text-gray-600 ml-1 md:text-sm">
                            {displayDuration}
                          </span>
                        </div>
                        <textarea
                          className="w-full p-1 border border-gray-300 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 resize-y md:p-2 md:text-sm"
                          rows={Math.max(2, displayBlock.duration * 2.5)}
                          placeholder="To-Do hier eingeben..."
                          value={todoText}
                          onChange={(e) =>
                            updateTodo(day, hourIndex, e.target.value)
                          }
                        />
                      </>
                    ) : (
                      <>
                        <div className="text-gray-400 italic text-xs md:text-sm"></div>
                        {(todoText ||
                          (editingTodo?.kw === currentKW &&
                            editingTodo?.day === day &&
                            editingTodo?.hourIndex === hourIndex)) && (
                          <textarea
                            className="w-full p-1 border border-gray-300 rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 resize-y md:p-2 md:text-sm mt-1"
                            rows={Math.max(1, displayBlock.duration * 2)}
                            placeholder="To-Do hier eingeben..."
                            value={todoText}
                            onChange={(e) =>
                              updateTodo(day, hourIndex, e.target.value)
                            }
                          />
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="p-4 space-y-4 font-sans antialiased bg-gray-50 min-h-screen flex flex-col">
      {/* Top: View Mode Buttons */}
      <div className="flex flex-wrap justify-center gap-1 md:gap-2 py-3 px-3 bg-white rounded-lg shadow-md md:py-4 md:px-4 mb-4">
        <button
          className={`px-3 py-1 text-sm rounded-full font-medium transition-all duration-200 md:px-5 md:py-2 md:text-base ${
            viewMode === "week"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("week")}
        >
          Wochenansicht
        </button>
        <button
          className={`px-3 py-1 text-sm rounded-full font-medium transition-all duration-200 ${
            viewMode === "todos"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("todos")}
        >
          To-Dos
        </button>
        <button
          className={`px-3 py-1 text-sm rounded-full font-medium transition-all duration-200 ${
            viewMode === "config"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setViewMode("config")}
        >
          Konfiguration
        </button>
      </div>

      {isLoading && (
        <div className="text-center text-gray-600 text-lg mt-8">
          Daten werden geladen...
        </div>
      )}

      {!isLoading && viewMode === "week" && (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md p-2 md:p-4 flex-grow flex flex-col">
          {renderTableSection(firstHalfDays)}

          <div className="my-6 md:my-8">
            <hr className="border-gray-300" />
          </div>

          {renderTableSection(secondHalfDays)}

          <div className="flex justify-between items-center mt-auto pt-4 md:pt-6">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-300 transition-colors duration-200 text-xl font-bold"
              aria-label="Vorherige Woche"
            >
              &larr;
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">
                KW {currentKW}
              </h2>
              <button
                onClick={() => setWeekOffset(0)} // Setzt den Offset auf 0 für die aktuelle Woche
                className="px-3 py-1 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600 transition-colors duration-200 text-sm font-bold"
              >
                Heute
              </button>
            </div>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-300 transition-colors duration-200 text-xl font-bold"
              aria-label="Nächste Woche"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}

      {!isLoading && viewMode === "todos" && (
        <div className="space-y-6 bg-white rounded-lg shadow-md p-4 md:p-6 flex-grow">
          <h1 className="text-xl font-bold text-gray-800 mb-4 md:text-2xl">
            Ihre To-Dos
          </h1>

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="hideCompleted"
              className="form-checkbox h-4 w-4 text-blue-600 rounded md:h-5 md:w-5"
              checked={hideCompletedTodos}
              onChange={() => setHideCompletedTodos(!hideCompletedTodos)}
            />
            <label
              htmlFor="hideCompleted"
              className="ml-2 text-sm text-gray-700 md:text-base"
            >
              Erledigte To-Dos ausblenden
            </label>
          </div>

          {Object.keys(todoData)
            .filter((kw) => {
              const weekNum = parseInt(kw);
              const weekData = todoData[weekNum] || {};
              return days.some((day) =>
                hours.some((_, hourIndex) => {
                  const todoItem = weekData[day]?.[hourIndex];
                  return (
                    todoItem &&
                    todoItem.text &&
                    (!hideCompletedTodos || !todoItem.done)
                  );
                })
              );
            })
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((kw) => {
              const weekNum = parseInt(kw);
              const weekData = todoData[weekNum] || {};

              return (
                <div
                  key={weekNum}
                  className="border-b border-gray-200 pb-4 last:border-b-0"
                >
                  <h2 className="font-bold text-lg text-blue-700 mb-3 md:text-xl">
                    KW {weekNum}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {days.map((day) =>
                      hours.map((_, hourIndex) => {
                        const todoItem = weekData[day]?.[hourIndex];
                        if (
                          !todoItem ||
                          !todoItem.text ||
                          (hideCompletedTodos && todoItem.done)
                        )
                          return null;

                        const isEditing =
                          editingTodo?.kw === weekNum &&
                          editingTodo?.day === day &&
                          editingTodo?.hourIndex === hourIndex;

                        const fachInfoForDisplay = defaultSchedule[day]?.[
                          hourIndex
                        ]?.fach
                          ? defaultSchedule[day]?.[hourIndex].fach
                          : "Frei";
                        const fachFarbeForDisplay = defaultSchedule[day]?.[
                          hourIndex
                        ]?.farbe
                          ? defaultSchedule[day]?.[hourIndex].farbe
                          : "bg-gray-100";

                        return (
                          <div
                            key={`${day}-${hourIndex}-${weekNum}`}
                            className={`p-3 rounded-lg shadow-sm border border-gray-200 md:p-4 ${fachFarbeForDisplay}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-gray-600 text-sm md:text-base">
                                <span className="font-semibold">
                                  {day}, {hours[hourIndex]}
                                </span>{" "}
                                ({fachInfoForDisplay})
                              </div>
                              <div className="flex space-x-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={saveEditedTodo}
                                      className="text-green-600 hover:text-green-800 text-sm md:text-base"
                                      title="Speichern"
                                    >
                                      &#10003;
                                    </button>
                                    <button
                                      onClick={cancelEditingTodo}
                                      className="text-red-600 hover:text-red-800 text-sm md:text-base"
                                      title="Abbrechen"
                                    >
                                      &#10007;
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() =>
                                        startEditingTodo(
                                          weekNum,
                                          day,
                                          hourIndex,
                                          todoItem.text
                                        )
                                      }
                                      className="text-blue-600 hover:text-blue-800 text-sm md:text-base"
                                      title="Bearbeiten"
                                    >
                                      &#9998;
                                    </button>
                                    <button
                                      onClick={() =>
                                        deleteTodo(weekNum, day, hourIndex)
                                      }
                                      className="text-red-500 hover:text-red-700 text-sm md:text-base"
                                      title="Löschen"
                                    >
                                      &#128465;
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isEditing ? (
                              <textarea
                                value={editingTodoText}
                                onChange={(e) =>
                                  setEditingTodoText(e.target.value)
                                }
                                className="w-full p-2 border border-gray-300 rounded-md resize-y text-sm md:text-base"
                                rows={3}
                              />
                            ) : (
                              <p
                                className={`text-gray-800 text-sm md:text-base ${
                                  todoItem.done
                                    ? "line-through text-gray-500"
                                    : ""
                                }`}
                              >
                                {todoItem.text}
                              </p>
                            )}
                            <div className="flex items-center mt-2">
                              <input
                                type="checkbox"
                                id={`todo-${weekNum}-${day}-${hourIndex}`}
                                className="form-checkbox h-4 w-4 text-blue-600 rounded md:h-5 md:w-5"
                                checked={todoItem.done}
                                onChange={() =>
                                  toggleTodoDone(weekNum, day, hourIndex)
                                }
                              />
                              <label
                                htmlFor={`todo-${weekNum}-${day}-${hourIndex}`}
                                className="ml-2 text-sm text-gray-700 md:text-base"
                              >
                                Erledigt
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

          {!hasTodosToDisplay(todoData, hideCompletedTodos) && (
            <p className="text-center text-gray-500 italic mt-8 text-sm md:text-base">
              Keine To-Dos gefunden. Füge sie im Stundenplan hinzu!
            </p>
          )}
        </div>
      )}

      {!isLoading && viewMode === "config" && (
        <div className="space-y-6 bg-white rounded-lg shadow-md p-4 md:p-6 flex-grow">
          <h1 className="text-xl font-bold text-gray-800 mb-4 md:text-2xl">
            Fächer konfigurieren
          </h1>

          <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex-grow">
              <label
                htmlFor="fachName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Fachname
              </label>
              <input
                type="text"
                id="fachName"
                value={fachName}
                onChange={(e) => setFachName(e.target.value)}
                placeholder="z.B. Mathematik"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              />
            </div>
            {/* START DES BENUTZERDEFINIERTEN FARB-DROPDOWNS */}
            <div className="relative" ref={colorDropdownRef}>
              {" "}
              {/* Ref hinzufügen */}
              <label
                htmlFor="fachFarbe"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Farbe
              </label>
              <button
                type="button" // Wichtig, damit es kein Submit-Button ist
                onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                className="w-full text-left p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-sm md:text-base flex items-center justify-between"
              >
                <span className="flex items-center">
                  <span
                    className={`inline-block w-4 h-4 rounded-full mr-2 ${fachFarbe}`}
                  ></span>
                  {fachFarbe.replace("bg-", "").replace("-100", "")}
                </span>
                <span className="ml-2 text-gray-500">
                  {isColorDropdownOpen ? "▲" : "▼"}
                </span>
              </button>
              {isColorDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {farboptionen.map((farbe) => (
                    <div
                      key={farbe}
                      className={`p-2 cursor-pointer hover:bg-gray-100 flex items-center ${
                        fachFarbe === farbe ? "bg-blue-50" : ""
                      }`}
                      onClick={() => {
                        setFachFarbe(farbe);
                        setIsColorDropdownOpen(false); // Dropdown nach Auswahl schließen
                      }}
                    >
                      <span
                        className={`inline-block w-4 h-4 rounded-full mr-2 ${farbe}`}
                      ></span>
                      {farbe.replace("bg-", "").replace("-100", "")}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ENDE DES BENUTZERDEFINIERTEN FARB-DROPDOWNS */}
            <div className="flex gap-2 mt-2 md:mt-0">
              <button
                onClick={handleFachSpeichern}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 transition-colors duration-200 text-sm md:text-base"
              >
                {bearbeiteIndex !== null ? "Speichern" : "Hinzufügen"}
              </button>
              {bearbeiteIndex !== null && (
                <button
                  onClick={handleAbbrechen}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md shadow-md hover:bg-gray-400 transition-colors duration-200 text-sm md:text-base"
                >
                  Abbrechen
                </button>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-3 md:text-xl">
            Zeiten für Fach festlegen
            {fachName && <span className="ml-2">({fachName})</span>}
          </h2>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider md:px-6 md:py-3">
                    Stunde
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider md:px-6 md:py-3"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hours.map((hourLabel, hourIndex) => (
                  <tr key={hourIndex}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 md:px-6 md:py-4">
                      {hourLabel}
                    </td>
                    {days.map((day) => {
                      const key = `${day}-${hourIndex}`;
                      const isSelected = fachZeiten[key];
                      const isOccupied = occupiedSlots[key];
                      const currentFachName =
                        defaultSchedule[day]?.[hourIndex]?.fach;

                      return (
                        <td
                          key={key}
                          className="px-3 py-2 whitespace-nowrap md:px-6 md:py-4"
                        >
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-colors duration-150 ease-in-out md:w-10 md:h-10
                            ${
                              isSelected
                                ? fachFarbe
                                : isOccupied
                                ? "bg-gray-200 cursor-not-allowed"
                                : "bg-white border border-gray-300 hover:bg-gray-100"
                            }
                          `}
                            onClick={() => toggleFachZeit(day, hourIndex)}
                            title={
                              isOccupied && !isSelected
                                ? `Belegt durch: ${currentFachName}`
                                : ""
                            }
                          >
                            {isSelected && (
                              <span className="text-white text-lg">
                                &#10003;
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-3 md:text-xl mt-8">
            Vorhandene Fächer
          </h2>
          {fächer.length === 0 ? (
            <p className="text-gray-500 italic text-sm md:text-base">
              Noch keine Fächer hinzugefügt.
            </p>
          ) : (
            <ul className="space-y-3">
              {fächer.map((fach, index) => (
                <li
                  key={fach.id || index}
                  className={`flex items-center justify-between p-3 rounded-lg shadow-sm border border-gray-200 md:p-4 ${fach.farbe}`}
                >
                  <span className="font-semibold text-gray-800 text-sm md:text-base">
                    {fach.name}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleFachBearbeiten(index)}
                      className="px-3 py-1 bg-yellow-400 text-gray-800 rounded-md shadow-sm hover:bg-yellow-500 transition-colors duration-200 text-xs md:px-4 md:py-2 md:text-sm"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleFachLöschen(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded-md shadow-sm hover:bg-red-600 transition-colors duration-200 text-xs md:px-4 md:py-2 md:text-sm"
                    >
                      Löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const hasTodosToDisplay = (todoData, hideCompleted) => {
  for (const kw in todoData) {
    for (const day in todoData[kw]) {
      for (const todoItem of todoData[kw][day]) {
        if (todoItem && todoItem.text && (!hideCompleted || !todoItem.done)) {
          return true;
        }
      }
    }
  }
  return false;
};
