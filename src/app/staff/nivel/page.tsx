import { obtenerMiNivel } from "./actions";
import { VistaNivel } from "./vista-nivel";

export const metadata = { title: "Mi Nivel" };

export default async function NivelPage() {
  const res = await obtenerMiNivel();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-10">
      <h1 className="font-display mb-6 text-[22px] font-bold uppercase text-text">Mi Nivel</h1>
      {res.ok ? <VistaNivel datos={res.data} /> : <p className="text-[13px] font-semibold text-danger">{res.error}</p>}
    </main>
  );
}
